/**
 * Web-specific Push Notification & Messaging Service
 *
 * Mengelola siklus Push Notification di platform Web menggunakan Firebase Web SDK Messaging:
 * 1. Pengecekan dukungan browser (`isSupported()`)
 * 2. Permintaan & pemeriksaan izin notifikasi browser (`Notification.permission`, `Notification.requestPermission()`)
 * 3. Registrasi token FCM Web menggunakan VAPID Key jika tersedia (`process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY`)
 * 4. Penyimpanan token ke `users/{uid}.fcmTokens` di Firestore
 * 5. Penanganan foreground notification melalui browser Notification API dan listener `onMessage`
 * 6. Fallback anggun (graceful fallback) jika VAPID belum dikonfigurasi atau browser tidak mendukung web push
 */

import {
  arrayRemove,
  arrayUnion,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  type Messaging,
} from 'firebase/messaging';
import { getApp } from '@/compat/firebase-app.web';
import { getSafeFirestoreDb } from '@/services/firebaseClient';
import {
  isNotificationForUser,
  isValidNotificationType,
} from '@/services/notificationTriggerRules';
import type {
  NotificationPermissionStatus,
  NotificationType,
  PushNotificationPayload,
  PushRegistrationState,
} from '@/types/notification';

export const PRACTICUM_NOTIFICATION_CHANNEL_ID = 'practicum_updates';
export const PRACTICUM_NOTIFICATION_CHANNEL_NAME = 'Notifikasi Praktikum';
const USERS_COLLECTION = 'users';

let backgroundHandlerRegistered = false;

export function getSafeFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const app = getApp();
    return getMessaging(app);
  } catch {
    return null;
  }
}

function readDataString(
  data: Record<string, unknown> | undefined,
  key: string,
): string {
  if (!data) return '';
  const value = data[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function isPermissionGranted(
  status: NotificationPermissionStatus,
): boolean {
  return status === 'granted' || status === 'provisional';
}

/**
 * Di web tidak ada notification channel Android, selalu return true.
 */
export async function ensureNotificationChannel(): Promise<boolean> {
  return true;
}

/**
 * Memeriksa status izin notifikasi browser.
 */
export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }
  if (Notification.permission === 'denied') {
    return 'denied';
  }
  return 'not_determined';
}

/**
 * Meminta izin notifikasi pada browser.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }

  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') return 'granted';
    if (result === 'denied') return 'denied';
    return 'not_determined';
  } catch {
    return 'unsupported';
  }
}

/**
 * Memberikan panduan pembukaan pengaturan izin notifikasi situs di browser.
 */
export async function openAppNotificationSettings(): Promise<void> {
  if (typeof window !== 'undefined') {
    alert(
      'Buka Pengaturan Situs di browser Anda (klik ikon gembok / setelan di samping alamat URL localhost) lalu izinkan Notifikasi.',
    );
  }
}

/**
 * Mengambil FCM registration token untuk web browser.
 */
export async function fetchDeviceFcmToken(): Promise<{
  token: string | null;
  error: string | null;
}> {
  if (typeof window === 'undefined') {
    return {
      token: null,
      error: 'Layanan notifikasi hanya dapat berjalan di lingkungan browser.',
    };
  }

  try {
    const supported = await isSupported().catch(() => false);
    if (!supported) {
      return {
        token: null,
        error: null, // Graceful: browser tidak mendukung ServiceWorker/PushManager
      };
    }

    const vapidKey =
      process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY ||
      (typeof process !== 'undefined' && process.env?.FIREBASE_VAPID_KEY) ||
      '';

    if (!vapidKey) {
      return {
        token: null,
        error: null, // VAPID key belum dikonfigurasi, ditangani secara anggun
      };
    }

    let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        serviceWorkerRegistration = await navigator.serviceWorker.register(
          '/firebase-messaging-sw.js',
        );
      } catch (swErr) {
        console.warn('Gagal mendaftarkan service worker:', swErr);
      }
    }

    const app = getApp();
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration,
    });

    const normalized = typeof token === 'string' ? token.trim() : '';
    if (!normalized) {
      return {
        token: null,
        error: 'Token Web Push belum tersedia.',
      };
    }

    return { token: normalized, error: null };
  } catch (error) {
    const detail =
      error instanceof Error && error.message
        ? error.message
        : 'Gagal mengambil token Web Push FCM.';
    return {
      token: null,
      error: detail,
    };
  }
}

/**
 * Menyimpan FCM token web ke profil pengguna `users/{uid}.fcmTokens` di Firestore.
 */
export async function saveUserFcmToken(
  uid: string,
  token: string,
): Promise<{ success: boolean; error: string | null }> {
  const normalizedUid = uid.trim();
  const normalizedToken = token.trim();

  if (!normalizedUid || !normalizedToken) {
    return {
      success: false,
      error: 'UID pengguna atau token FCM tidak valid.',
    };
  }

  const db = getSafeFirestoreDb();
  if (!db) {
    return {
      success: false,
      error: 'Cloud Firestore belum tersedia untuk menyimpan token FCM.',
    };
  }

  try {
    await updateDoc(doc(db, USERS_COLLECTION, normalizedUid), {
      fcmTokens: arrayUnion(normalizedToken),
      updatedAt: serverTimestamp(),
    });
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Gagal menyimpan token notifikasi ke Firestore.',
    };
  }
}

/**
 * Menghapus FCM token dari `users/{uid}.fcmTokens` (saat logout).
 */
export async function removeUserFcmToken(
  uid: string,
  token: string,
): Promise<{ success: boolean; error: string | null }> {
  const normalizedUid = uid.trim();
  const normalizedToken = token.trim();

  if (!normalizedUid || !normalizedToken) {
    return { success: false, error: null };
  }

  const db = getSafeFirestoreDb();
  if (!db) {
    return { success: false, error: null };
  }

  try {
    await updateDoc(doc(db, USERS_COLLECTION, normalizedUid), {
      fcmTokens: arrayRemove(normalizedToken),
      updatedAt: serverTimestamp(),
    });
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Gagal menghapus token notifikasi dari Firestore.',
    };
  }
}

/**
 * Mengonversi remote message atau payload data menjadi PushNotificationPayload.
 */
export function parseRemoteMessageToPayload(
  remoteMessage: any,
): PushNotificationPayload | null {
  if (!remoteMessage) {
    return null;
  }

  const data = remoteMessage.data as Record<string, unknown> | undefined;
  const title =
    (typeof remoteMessage.notification?.title === 'string'
      ? remoteMessage.notification.title.trim()
      : '') || readDataString(data, 'title');
  const body =
    (typeof remoteMessage.notification?.body === 'string'
      ? remoteMessage.notification.body.trim()
      : '') || readDataString(data, 'body');

  if (!title && !body) {
    return null;
  }

  const rawType = readDataString(data, 'type');
  const type: NotificationType = isValidNotificationType(rawType)
    ? rawType
    : 'SESSION_OPENED';

  const relatedId =
    readDataString(data, 'relatedId') || readDataString(data, 'scheduleId');
  const scheduleId = readDataString(data, 'scheduleId') || relatedId;
  const recipientUid = readDataString(data, 'recipientUid') || undefined;

  return {
    id:
      remoteMessage.messageId ||
      readDataString(data, 'notificationId') ||
      undefined,
    title: title || 'Notifikasi Praktikum',
    body: body || 'Ada pembaruan baru terkait kegiatan praktikum Anda.',
    type,
    relatedId,
    scheduleId: scheduleId || undefined,
    recipientUid,
  };
}

/**
 * Menampilkan notifikasi visual di browser saat foreground.
 */
export async function displayForegroundNotification(
  payload: PushNotificationPayload,
): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    new Notification(payload.title, {
      body: payload.body,
      icon: '/assets/images/icon.png',
      data: payload,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Mendaftarkan handler background / Service Worker di web root.
 */
export function registerBackgroundPushHandler(): void {
  if (
    backgroundHandlerRegistered ||
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }

  navigator.serviceWorker
    .register('/firebase-messaging-sw.js')
    .then(() => {
      backgroundHandlerRegistered = true;
    })
    .catch(() => {
      // Abaikan jika service worker belum siap di development
    });
}

export interface SetupPushNotificationsCallbacks {
  onStateChange: (state: PushRegistrationState) => void;
  onForegroundMessage?: (payload: PushNotificationPayload) => void;
  onNotificationOpened?: (payload: PushNotificationPayload) => void;
}

export interface PushNotificationSessionHandle {
  unsubscribe: () => void;
  getCurrentToken: () => string | null;
}

/**
 * Mengaktifkan integrasi push notification untuk pengguna aktif di Web:
 * - Memeriksa izin notifikasi browser
 * - Jika VAPID key dikonfigurasi, mengambil dan menyimpan token FCM Web
 * - Jika VAPID belum ada atau web push tidak didukung, menangani kondisi secara anggun (tanpa error fatal)
 */
export function setupUserPushNotifications(
  uid: string,
  callbacks: SetupPushNotificationsCallbacks,
): PushNotificationSessionHandle {
  let isActive = true;
  let currentToken: string | null = null;
  const unsubscribers: (() => void)[] = [];

  const emitState = (state: PushRegistrationState) => {
    if (isActive) {
      callbacks.onStateChange(state);
    }
  };

  const start = async () => {
    emitState({
      permissionStatus: 'not_determined',
      fcmToken: null,
      tokenSynced: false,
      error: null,
      isRegistering: true,
    });

    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      emitState({
        permissionStatus: 'unsupported',
        fcmToken: null,
        tokenSynced: false,
        error: null,
        isRegistering: false,
      });
      return;
    }

    const supported = await isSupported().catch(() => false);
    if (!supported) {
      emitState({
        permissionStatus: 'unsupported',
        fcmToken: null,
        tokenSynced: false,
        error: null,
        isRegistering: false,
      });
      return;
    }

    const currentPermission = await getNotificationPermissionStatus();
    if (!isActive) return;

    if (currentPermission === 'denied') {
      emitState({
        permissionStatus: 'denied',
        fcmToken: null,
        tokenSynced: false,
        error:
          'Izin notifikasi ditolak di browser. Aktifkan notifikasi pada pengaturan browser untuk menerima info sesi, jadwal, dan izin.',
        isRegistering: false,
      });
      return;
    }

    const vapidKey =
      process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY ||
      (typeof process !== 'undefined' && process.env?.FIREBASE_VAPID_KEY) ||
      '';

    if (!vapidKey) {
      // VAPID key belum diset. Izin browser dipertahankan tanpa memunculkan error fatal.
      emitState({
        permissionStatus: currentPermission,
        fcmToken: null,
        tokenSynced: false,
        error: null,
        isRegistering: false,
      });
      return;
    }

    // Jika VAPID key tersedia, lakukan registrasi penuh:
    const permissionStatus =
      currentPermission === 'granted'
        ? 'granted'
        : await requestNotificationPermission();

    if (!isActive) return;

    if (!isPermissionGranted(permissionStatus)) {
      emitState({
        permissionStatus,
        fcmToken: null,
        tokenSynced: false,
        error:
          permissionStatus === 'denied'
            ? 'Izin notifikasi ditolak di browser.'
            : null,
        isRegistering: false,
      });
      return;
    }

    const { token, error: tokenError } = await fetchDeviceFcmToken();
    if (!isActive) return;

    if (!token) {
      emitState({
        permissionStatus,
        fcmToken: null,
        tokenSynced: false,
        error: tokenError,
        isRegistering: false,
      });
    } else {
      currentToken = token;
      const saveRes = await saveUserFcmToken(uid, token);
      if (!isActive) return;

      emitState({
        permissionStatus,
        fcmToken: token,
        tokenSynced: saveRes.success,
        error: saveRes.success ? null : saveRes.error,
        isRegistering: false,
      });
    }

    // Listener pesan foreground di web
    try {
      const app = getApp();
      const messaging = getMessaging(app);
      const unsub = onMessage(messaging, (payload) => {
        if (!isActive) return;
        const parsed = parseRemoteMessageToPayload(payload);
        if (parsed && isNotificationForUser(parsed, uid)) {
          void displayForegroundNotification(parsed);
          callbacks.onForegroundMessage?.(parsed);
        }
      });
      unsubscribers.push(unsub);
    } catch {
      // Listener foreground opsional
    }
  };

  void start();

  return {
    unsubscribe: () => {
      isActive = false;
      unsubscribers.forEach((fn) => {
        try {
          fn();
        } catch {
          // Abaikan
        }
      });
      unsubscribers.length = 0;
    },
    getCurrentToken: () => currentToken,
  };
}
