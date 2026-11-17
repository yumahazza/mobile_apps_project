import { useEffect, useState } from 'react';
import {
  PracticumSchedule,
  ScheduleRole,
  subscribeToPracticumSchedules,
} from '@/services/practicumScheduleService';

interface ScheduleState {
  schedules: PracticumSchedule[];
  loading: boolean;
  error: string | null;
}

/**
 * Each screen subscribes to the current user's authorized schedule query.
 * Listener is removed automatically when UID/role changes or screen unmounts.
 */
export function useFirestoreSchedules(uid: string, role: ScheduleRole): ScheduleState {
  const requestKey = uid ? `${uid}:${role}` : '';
  const [state, setState] = useState<{
    key: string;
    schedules: PracticumSchedule[];
    error: string | null;
  }>({
    key: '',
    schedules: [],
    error: null,
  });

  useEffect(() => {
    if (!uid) {
      return undefined;
    }

    const activeKey = `${uid}:${role}`;
    const unsubscribe = subscribeToPracticumSchedules(
      uid,
      role,
      schedules => setState({ key: activeKey, schedules, error: null }),
      message => setState({ key: activeKey, schedules: [], error: message }),
    );

    return unsubscribe;
  }, [uid, role]);

  if (!uid) {
    return {
      schedules: [],
      loading: false,
      error: 'UID pengguna belum tersedia. Silakan login kembali.',
    };
  }

  return {
    schedules: state.key === requestKey ? state.schedules : [],
    loading: state.key !== requestKey,
    error: state.key === requestKey ? state.error : null,
  };
}
