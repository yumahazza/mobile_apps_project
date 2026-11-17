/**
 * Lintang — Hook Rekap Kehadiran Real-time
 * SRS-AST-003, SRS-AST-004
 *
 * Mendengarkan perubahan dokumen `attendances` untuk satu sesi secara real-time via onSnapshot.
 * Menghitung metrik kehadiran (hadir, izin, alfa, persentase) secara reaktif dari Firestore asli.
 */
import { useEffect, useState } from 'react';
import type { AttendanceRecordItem, AttendanceStats } from '@/types/attendance';
import {
  calculateAttendanceStats,
  subscribeToScheduleAttendances,
} from '@/services/attendanceService';

interface RealtimeAttendanceState {
  attendances: AttendanceRecordItem[];
  stats: AttendanceStats;
  loading: boolean;
  error: string | null;
}

export function useRealtimeAttendance(
  scheduleId?: string,
  totalStudents: number = 0,
): RealtimeAttendanceState {
  const activeKey = scheduleId?.trim() || '';
  const [state, setState] = useState<{
    key: string;
    attendances: AttendanceRecordItem[];
    error: string | null;
  }>({
    key: '',
    attendances: [],
    error: null,
  });

  useEffect(() => {
    if (!activeKey) {
      return undefined;
    }

    const targetKey = activeKey;
    const unsubscribe = subscribeToScheduleAttendances(
      targetKey,
      records => {
        setState({ key: targetKey, attendances: records, error: null });
      },
      err => {
        setState({ key: targetKey, attendances: [], error: err });
      },
    );

    return () => {
      unsubscribe();
    };
  }, [activeKey]);

  const attendances = activeKey && state.key === activeKey ? state.attendances : [];
  const loading = Boolean(activeKey) && state.key !== activeKey;
  const error = activeKey && state.key === activeKey ? state.error : null;
  const stats = calculateAttendanceStats(totalStudents, attendances);

  return {
    attendances,
    stats,
    loading,
    error,
  };
}
