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
  const [attendances, setAttendances] = useState<AttendanceRecordItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scheduleId?.trim()) {
      setAttendances([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToScheduleAttendances(
      scheduleId,
      records => {
        setAttendances(records);
        setLoading(false);
        setError(null);
      },
      err => {
        setAttendances([]);
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [scheduleId]);

  const stats = calculateAttendanceStats(totalStudents, attendances);

  return {
    attendances,
    stats,
    loading,
    error,
  };
}
