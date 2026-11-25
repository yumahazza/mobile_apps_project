/**
 * Fritz — Notification History Firestore Service (Sprint 3)
 *
 * Membaca riwayat notifikasi pengguna dari koleksi `notifications` di Cloud Firestore
 * (`recipientUid == activeUser.id`) dan menandai notifikasi sebagai telah dibaca (`readAt`).
 */

import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from '@react-native-firebase/firestore';
import { getSafeFirestoreDb } from '@/services/firebaseClient';
import { parseFirestoreTimestampToString } from '@/services/attendanceService';
import { isValidNotificationType } from '@/services/notificationTriggerRules';
import type {
  NotificationType,
  StoredNotificationItem,
} from '@/types/notification';

const NOTIFICATIONS_COLLECTION = 'notifications';

function toMillis(rawTimestamp: unknown): number {
  if (!rawTimestamp) return 0;
  if (
    typeof rawTimestamp === 'object' &&
    rawTimestamp !== null &&
    'toMillis' in rawTimestamp &&
    typeof (rawTimestamp as Timestamp).toMillis === 'function'
  ) {
    return (rawTimestamp as Timestamp).toMillis();
  }
  if (rawTimestamp instanceof Date) {
    return rawTimestamp.getTime();
  }
  if (typeof rawTimestamp === 'number' && Number.isFinite(rawTimestamp)) {
    return rawTimestamp;
  }
  if (typeof rawTimestamp === 'string') {
    const parsed = Date.parse(rawTimestamp);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function mapFirestoreNotification(
  docId: string,
  raw: Record<string, unknown>,
): StoredNotificationItem {
  const createdParsed = parseFirestoreTimestampToString(raw.createdAt);
  const readParsed = raw.readAt
    ? parseFirestoreTimestampToString(raw.readAt)
    : null;
  const type: NotificationType = isValidNotificationType(raw.type)
    ? raw.type
    : 'SESSION_OPENED';

  return {
    id: String(raw.id || docId),
    recipientUid: String(raw.recipientUid ?? ''),
    title: String(raw.title ?? 'Notifikasi Praktikum'),
    body: String(raw.body ?? ''),
    type,
    relatedId: String(raw.relatedId ?? ''),
    createdAt: `${createdParsed.dateStr} · ${createdParsed.timeStr}`,
    rawCreatedAt: raw.createdAt ?? null,
    readAt: readParsed ? `${readParsed.dateStr} · ${readParsed.timeStr}` : null,
  };
}

/**
 * Berlangganan riwayat notifikasi milik pengguna secara real-time.
 * Sorting dilakukan di sisi client agar tidak membutuhkan composite index Firestore.
 */
export function subscribeToUserNotifications(
  uid: string,
  onData: (items: StoredNotificationItem[]) => void,
  onError?: (message: string) => void,
): () => void {
  const normalizedUid = uid.trim();
  if (!normalizedUid) {
    onData([]);
    return () => undefined;
  }

  const db = getSafeFirestoreDb();
  if (!db) {
    onData([]);
    return () => undefined;
  }

  const notificationsQuery = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('recipientUid', '==', normalizedUid),
  );

  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      const items = snapshot.docs
        .map((docSnap) =>
          mapFirestoreNotification(
            docSnap.id,
            docSnap.data() as Record<string, unknown>,
          ),
        )
        .filter((item) => item.recipientUid === normalizedUid)
        .sort((a, b) => toMillis(b.rawCreatedAt) - toMillis(a.rawCreatedAt));

      onData(items);
    },
    (error) => {
      onError?.(
        error.message || 'Gagal memuat riwayat notifikasi dari Firestore.',
      );
    },
  );
}

/**
 * Menandai satu dokumen notifikasi sebagai sudah dibaca oleh penerimanya.
 */
export async function markNotificationAsRead(
  notificationId: string,
): Promise<boolean> {
  const normalizedId = notificationId.trim();
  if (!normalizedId) return false;

  const db = getSafeFirestoreDb();
  if (!db) return false;

  try {
    await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, normalizedId), {
      readAt: serverTimestamp(),
    });
    return true;
  } catch {
    return false;
  }
}
