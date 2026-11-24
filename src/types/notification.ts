/**
 * Fritz — Notification & FCM Types (Sprint 3)
 * Kontrak data untuk push notification FCM dan riwayat koleksi `notifications` di Firestore.
 */

export type NotificationType =
  | 'SESSION_OPENED'
  | 'SCHEDULE_UPDATED'
  | 'LEAVE_APPROVED'
  | 'LEAVE_REJECTED';

export type NotificationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'provisional'
  | 'not_determined'
  | 'unsupported';

export interface StoredNotificationItem {
  id: string;
  recipientUid: string;
  title: string;
  body: string;
  type: NotificationType;
  relatedId: string;
  createdAt: string;
  rawCreatedAt?: unknown;
  readAt: string | null;
}

export interface PushNotificationPayload {
  id?: string;
  title: string;
  body: string;
  type: NotificationType;
  relatedId: string;
  scheduleId?: string;
  recipientUid?: string;
}

export interface PushRegistrationState {
  permissionStatus: NotificationPermissionStatus;
  fcmToken: string | null;
  tokenSynced: boolean;
  error: string | null;
  isRegistering: boolean;
}

export interface NotificationNavigationTarget {
  screen: 'SessionDetail' | 'LeaveRequest' | 'Notifications';
  params?: {
    scheduleId?: string;
  };
}
