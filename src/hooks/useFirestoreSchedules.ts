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
  const [state, setState] = useState<ScheduleState>({
    schedules: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    setState({ schedules: [], loading: true, error: null });
    if (!uid) {
      setState({
        schedules: [],
        loading: false,
        error: 'UID pengguna belum tersedia. Silakan login kembali.',
      });
      return undefined;
    }

    const unsubscribe = subscribeToPracticumSchedules(
      uid,
      role,
      schedules => setState({ schedules, loading: false, error: null }),
      message => setState(prev => ({ ...prev, loading: false, error: message })),
    );

    return unsubscribe;
  }, [uid, role]);

  return state;
}
