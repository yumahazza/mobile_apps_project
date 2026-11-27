import { useEffect, useState } from 'react';
import { subscribeToUserNotifications } from '@/services/notificationHistoryService';
import type { StoredNotificationItem } from '@/types/notification';

interface UserNotificationsState {
  uid: string;
  items: StoredNotificationItem[];
  error: string | null;
}

export function useUserNotifications(uid?: string) {
  const normalizedUid = uid?.trim() || '';
  const [state, setState] = useState<UserNotificationsState>({
    uid: '',
    items: [],
    error: null,
  });

  useEffect(() => {
    if (!normalizedUid) {
      return undefined;
    }

    const unsubscribe = subscribeToUserNotifications(
      normalizedUid,
      (items) => {
        setState({
          uid: normalizedUid,
          items,
          error: null,
        });
      },
      (message) => {
        setState({
          uid: normalizedUid,
          items: [],
          error: message,
        });
      },
    );

    return () => unsubscribe();
  }, [normalizedUid]);

  const isSyncedForUid = Boolean(normalizedUid) && state.uid === normalizedUid;
  const notifications = isSyncedForUid ? state.items : [];
  const loading = Boolean(normalizedUid) && !isSyncedForUid;
  const error = isSyncedForUid ? state.error : null;
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  return {
    notifications,
    unreadCount,
    loading,
    error,
  };
}
