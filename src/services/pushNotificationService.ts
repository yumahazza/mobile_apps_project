/**
 * Fritz — Push Notification & FCM Service (Sprint 3)
 *
 * Mengelola seluruh siklus Push Notification berbasis Firebase Cloud Messaging (FCM):
 * 1. Pembuatan Android Notification Channel (`practicum_updates`)
 * 2. Permintaan & pengecekan izin notifikasi perangkat (Android 13+ & iOS)
 * 3. Pengambilan, penyimpanan (`users/{uid}.fcmTokens`), pembaruan (`onTokenRefresh`),
 *    dan pembersihan token FCM saat logout
 * 4. Penanganan notifikasi foreground (tampil via react-native-notify-kit),
 *    background/quit (`setBackgroundMessageHandler`), dan interaksi tap notifikasi
 * 5. Validasi penerima & penanganan kondisi gagal (izin ditolak, token tidak tersedia, offline)
 */

import { Linking, PermissionsAndroid, Platform } from 'react-native';
import {
  AuthorizationStatus as MessagingAuthorizationStatus,
  getInitialNotification as getInitialMessagingNotification,
  getMessaging,
  getToken,
  hasPermission as hasMessagingPermission,
  isDeviceRegisteredForRemoteMessages,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission as requestMessagingPermission,
  setBackgroundMessageHandler,
  type Messaging,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import {
  arrayRemove,
  arrayUnion,
  doc,
  serverTimestamp,
  updateDoc,
} from '@react-native-firebase/firestore';
import notifee, {
  AndroidImportance,
  AuthorizationStatus as NotifyAuthorizationStatus,
  EventType,
} from 'react-native-notify-kit';
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
let channelInitialized = false;

export function getSafeFirebaseMessaging(): Messaging | null {
  try {
    return getMessaging();
  } catch {
    return null;
  }
}

function getAndroidApiLevel(): number {
  if (Platform.OS !== 'android') return 0;
  return typeof Platform.Version === 'number'
    ? Platform.Version
    : Number.parseInt(String(Platform.Version), 10) || 0;
}

function readDataString(
  data: Record<string, unknown> | undefined,
  key: string,
): string {
  if (!data) return '';
  const value = data[key];
  return typeof value === 'string' ? value.trim() : '';
}

function mapNotifyAuthStatus(status: number): NotificationPermissionStatus {
  if (status === NotifyAuthorizationStatus.AUTHORIZED) return 'granted';
  if (status === NotifyAuthorizationStatus.PROVISIONAL) return 'provisional';
  if (status === NotifyAuthorizationStatus.DENIED) return 'denied';
  return 'not_determined';
}

function mapMessagingAuthStatus(status: number): NotificationPermissionStatus {
  if (status === MessagingAuthorizationStatus.AUTHORIZED) return 'granted';
  if (status === MessagingAuthorizationStatus.PROVISIONAL) return 'provisional';
  if (status === MessagingAuthorizationStatus.DENIED) return 'denied';
  return 'not_determined';
}

export function isPermissionGranted(
  status: NotificationPermissionStatus,
): boolean {
  return status === 'granted' || status === 'provisional';
}

/**
 * Membuat notification channel prioritas tinggi untuk Android 8+.
 */
export async function ensureNotificationChannel(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  if (channelInitialized) {
    return true;
  }

  try {
    await notifee.createChannel({
      id: PRACTICUM_NOTIFICATION_CHANNEL_ID,
      name: PRACTICUM_NOTIFICATION_CHANNEL_NAME,
      description:
        'Pemberitahuan pembukaan sesi praktikum, perubahan jadwal, dan keputusan izin.',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
    });
    channelInitialized = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Memeriksa status izin notifikasi perangkat saat ini tanpa memunculkan dialog sistem.
 */
export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'web') {
    return 'unsupported';
  }

  try {
    const settings = await notifee.getNotificationSettings();
    return mapNotifyAuthStatus(settings.authorizationStatus);
  } catch {
    // Fallback ke PermissionsAndroid / Firebase Messaging jika native module notify-kit belum tersedia.
  }

  if (Platform.OS === 'android') {
    if (getAndroidApiLevel() < 33) {
      return 'granted';
    }
    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      return granted ? 'granted' : 'denied';
    } catch {
      return 'unsupported';
    }
  }

  const messaging = getSafeFirebaseMessaging();
  if (!messaging) {
    return 'unsupported';
  }

  try {
    const authStatus = await hasMessagingPermission(messaging);
    return mapMessagingAuthStatus(authStatus);
  } catch {
    return 'unsupported';
  }
}

/**
 * Meminta izin push notification pada perangkat (Android 13+ POST_NOTIFICATIONS & iOS).
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'web') {
    return 'unsupported';
  }

  if (Platform.OS === 'android' && getAndroidApiLevel() >= 33) {
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Izin Notifikasi Praktikum',
          message:
            'Izinkan aplikasi mengirim pemberitahuan saat sesi presensi dibuka, jadwal berubah, atau pengajuan izin diputuskan.',
          buttonPositive: 'Izinkan',
          buttonNegative: 'Nanti',
        },
      );
      return result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
    } catch {
      // Lanjut fallback ke notifee.requestPermission di bawah.
    }
  }

  try {
    const settings = await notifee.requestPermission();
    return mapNotifyAuthStatus(settings.authorizationStatus);
  } catch {
    // Fallback ke Firebase Messaging permission pada iOS.
  }

  const messaging = getSafeFirebaseMessaging();
  if (!messaging) {
    return 'unsupported';
  }

  try {
    const authStatus = await requestMessagingPermission(messaging);
    return mapMessagingAuthStatus(authStatus);
  } catch {
    return 'denied';
  }
}

/**
 * Membuka pengaturan notifikasi aplikasi di sistem operasi perangkat.
 */
export async function openAppNotificationSettings(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    if (Platform.OS === 'android') {
      await notifee.openNotificationSettings(PRACTICUM_NOTIFICATION_CHANNEL_ID);
      return;
    }
  } catch {
    // Fallback ke Linking.openSettings()
  }

  try {
    await Linking.openSettings();
  } catch {
    // Abaikan jika perangkat tidak mendukung pembukaan settings.
  }
}

/**
 * Mengambil FCM registration token perangkat secara aman.
 */
export async function fetchDeviceFcmToken(): Promise<{
  token: string | null;
  error: string | null;
}> {
  if (Platform.OS === 'web') {
    return {
      token: null,
      error: 'Push notification FCM tidak didukung pada mode Web.',
    };
  }

  const messaging = getSafeFirebaseMessaging();
  if (!messaging) {
    return {
      token: null,
      error:
        'Modul Firebase Cloud Messaging belum siap. Gunakan Development Build Android/iOS.',
    };
  }

  try {
    if (Platform.OS === 'ios' && !isDeviceRegisteredForRemoteMessages(messaging)) {
      await registerDeviceForRemoteMessages(messaging);
    }

    const token = await getToken(messaging);
    const normalized = typeof token === 'string' ? token.trim() : '';

    if (!normalized) {
      return {
        token: null,
        error: 'Token FCM perangkat belum tersedia. Periksa koneksi internet dan Google Play Services.',
      };
    }

    return { token: normalized, error: null };
  } catch (error) {
    const detail =
      error instanceof Error && error.message
        ? error.message
        : 'Gagal mengambil token FCM perangkat.';
    return {
      token: null,
      error: detail,
    };
  }
}

/**
 * Menyimpan FCM token perangkat ke profil pengguna `users/{uid}.fcmTokens` di Firestore.
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
 * Menghapus FCM token perangkat dari `users/{uid}.fcmTokens` (mis. saat logout atau refresh token).
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
 * Mengonversi RemoteMessage FCM atau payload data menjadi struktur PushNotificationPayload yang konsisten.
 */
export function parseRemoteMessageToPayload(
  remoteMessage: Pick<RemoteMessage, 'messageId' | 'notification' | 'data'> | null | undefined,
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

  const relatedId = readDataString(data, 'relatedId') || readDataString(data, 'scheduleId');
  const scheduleId = readDataString(data, 'scheduleId') || relatedId;
  const recipientUid = readDataString(data, 'recipientUid') || undefined;

  return {
    id: remoteMessage.messageId || readDataString(data, 'notificationId') || undefined,
    title: title || 'Notifikasi Praktikum',
    body: body || 'Ada pembaruan baru terkait kegiatan praktikum Anda.',
    type,
    relatedId,
    scheduleId: scheduleId || undefined,
    recipientUid,
  };
}

/**
 * Menampilkan notifikasi lokal sistem saat push masuk dalam kondisi aplikasi terbuka (foreground)
 * maupun saat pesan data-only diterima di background.
 */
export async function displayForegroundNotification(
  payload: PushNotificationPayload,
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    await ensureNotificationChannel();
    await notifee.displayNotification({
      id: payload.id,
      title: payload.title,
      body: payload.body,
      data: {
        type: payload.type,
        relatedId: payload.relatedId,
        scheduleId: payload.scheduleId || payload.relatedId,
        ...(payload.recipientUid ? { recipientUid: payload.recipientUid } : {}),
      },
      android: {
        channelId: PRACTICUM_NOTIFICATION_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Mendaftarkan handler background FCM & notify-kit pada level root aplikasi.
 * Idempoten dan aman dipanggil di semua platform (no-op di Web / Expo Go).
 */
export function registerBackgroundPushHandler(): void {
  if (backgroundHandlerRegistered || Platform.OS === 'web') {
    return;
  }

  const messaging = getSafeFirebaseMessaging();
  if (!messaging) {
    return;
  }

  try {
    setBackgroundMessageHandler(messaging, async (remoteMessage) => {
      // Jika payload sudah menyertakan objek `notification`, OS Android/iOS otomatis
      // menampilkan notifikasi sistem di background. Untuk pesan data-only, tampilkan via notify-kit.
      if (!remoteMessage.notification) {
        const payload = parseRemoteMessageToPayload(remoteMessage);
        if (payload) {
          await displayForegroundNotification(payload);
        }
      }
    });

    notifee.onBackgroundEvent(async ({ type }) => {
      if (type === EventType.PRESS) {
        // Interaksi tap dari background akan diproses melalui getInitialNotification saat app aktif.
      }
    });

    backgroundHandlerRegistered = true;
  } catch {
    // Jangan gagalkan bootstrap aplikasi jika modul native belum terpasang.
  }
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
 * Mengaktifkan integrasi FCM penuh untuk pengguna yang sedang login:
 * - Memastikan channel Android
 * - Meminta izin notifikasi perangkat
 * - Mengambil & menyimpan FCM token ke `users/{uid}.fcmTokens`
 * - Memantau token refresh, pesan foreground, dan event buka notifikasi dari background/quit
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

  const handleOpenPayload = (payload: PushNotificationPayload | null) => {
    if (!isActive || !payload) return;
    if (!isNotificationForUser(payload, uid)) return;
    callbacks.onNotificationOpened?.(payload);
  };

  const start = async () => {
    emitState({
      permissionStatus: 'not_determined',
      fcmToken: null,
      tokenSynced: false,
      error: null,
      isRegistering: true,
    });

    if (Platform.OS === 'web') {
      emitState({
        permissionStatus: 'unsupported',
        fcmToken: null,
        tokenSynced: false,
        error: 'Push notification FCM memerlukan Development Build Android/iOS.',
        isRegistering: false,
      });
      return;
    }

    await ensureNotificationChannel();
    if (!isActive) return;

    const permissionStatus = await requestNotificationPermission();
    if (!isActive) return;

    if (!isPermissionGranted(permissionStatus)) {
      emitState({
        permissionStatus,
        fcmToken: null,
        tokenSynced: false,
        error:
          permissionStatus === 'denied'
            ? 'Izin notifikasi ditolak. Aktifkan notifikasi di pengaturan perangkat untuk menerima info sesi, jadwal, dan izin.'
            : 'Perangkat tidak mendukung layanan push notification.',
        isRegistering: false,
      });
      return;
    }

    const messaging = getSafeFirebaseMessaging();
    if (!messaging) {
      emitState({
        permissionStatus,
        fcmToken: null,
        tokenSynced: false,
        error: 'Modul Firebase Cloud Messaging belum tersedia pada build ini.',
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
        error: tokenError || 'Token FCM perangkat tidak tersedia.',
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
        error: saveRes.success
          ? null
          : saveRes.error || 'Token FCM berhasil diambil, tetapi gagal disimpan ke Firestore.',
        isRegistering: false,
      });
    }

    // 1. Pantau pembaruan FCM token
    try {
      const unsubRefresh = onTokenRefresh(messaging, async (newToken) => {
        if (!isActive || !newToken?.trim()) return;
        const previousToken = currentToken;
        currentToken = newToken.trim();

        if (previousToken && previousToken !== currentToken) {
          await removeUserFcmToken(uid, previousToken);
        }

        const saveRes = await saveUserFcmToken(uid, currentToken);
        emitState({
          permissionStatus,
          fcmToken: currentToken,
          tokenSynced: saveRes.success,
          error: saveRes.success ? null : saveRes.error,
          isRegistering: false,
        });
      });
      unsubscribers.push(unsubRefresh);
    } catch {
      // Abaikan jika listener refresh tidak didukung di lingkungan uji.
    }

    // 2. Pantau pesan FCM saat aplikasi terbuka (foreground)
    try {
      const unsubForeground = onMessage(messaging, async (remoteMessage) => {
        if (!isActive) return;
        const payload = parseRemoteMessageToPayload(remoteMessage);
        if (!payload || !isNotificationForUser(payload, uid)) {
          return;
        }

        await displayForegroundNotification(payload);
        callbacks.onForegroundMessage?.(payload);
      });
      unsubscribers.push(unsubForeground);
    } catch {
      // Abaikan jika listener foreground gagal didaftarkan.
    }

    // 3. Pantau saat notifikasi FCM ditekan dari background
    try {
      const unsubOpened = onNotificationOpenedApp(messaging, (remoteMessage) => {
        handleOpenPayload(parseRemoteMessageToPayload(remoteMessage));
      });
      unsubscribers.push(unsubOpened);
    } catch {
      // Abaikan
    }

    // 4. Cek notifikasi FCM yang membuka aplikasi dari kondisi quit/terminated
    try {
      const initialRemote = await getInitialMessagingNotification(messaging);
      handleOpenPayload(parseRemoteMessageToPayload(initialRemote));
    } catch {
      // Abaikan
    }

    // 5. Pantau interaksi tap notifikasi lokal yang ditampilkan di foreground via notify-kit
    try {
      const unsubNotifee = notifee.onForegroundEvent(({ type, detail }) => {
        if (type === EventType.PRESS && detail.notification) {
          const payload = parseRemoteMessageToPayload({
            messageId: detail.notification.id,
            notification: {
              title: detail.notification.title,
              body: detail.notification.body,
            },
            data: detail.notification.data as Record<string, string | object> | undefined,
          });
          handleOpenPayload(payload);
        }
      });
      unsubscribers.push(unsubNotifee);
    } catch {
      // Abaikan
    }

    // 6. Cek initial notification dari notify-kit
    try {
      const initialLocal = await notifee.getInitialNotification();
      if (initialLocal?.notification) {
        const payload = parseRemoteMessageToPayload({
          messageId: initialLocal.notification.id,
          notification: {
            title: initialLocal.notification.title,
            body: initialLocal.notification.body,
          },
          data: initialLocal.notification.data as Record<string, string | object> | undefined,
        });
        handleOpenPayload(payload);
      }
    } catch {
      // Abaikan
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
          // Abaikan error cleanup listener.
        }
      });
      unsubscribers.length = 0;
    },
    getCurrentToken: () => currentToken,
  };
}
