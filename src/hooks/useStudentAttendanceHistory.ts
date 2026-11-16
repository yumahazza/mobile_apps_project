/**
 * Lintang — Hook Riwayat Kehadiran Praktikan
 * SRS-STU-003
 *
 * Mengambil dan mendengarkan riwayat presensi praktikan dari koleksi `attendances`
 * secara real-time berdasarkan Firebase UID praktikan yang sedang login.
 * Menghindari kebocoran data presensi mahasiswa lain.
 */
import { useEffect, useState } from 'react';
import type { AttendanceRecordItem } from '@/types/attendance';
import { subscribeToStudentHistory } from '@/services/attendanceService';

interface StudentHistoryState {
  historyRecords: AttendanceRecordItem[];
  loading: boolean;
  error: string | null;
}

export function useStudentAttendanceHistory(
  studentUid?: string,
): StudentHistoryState {
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecordItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentUid?.trim()) {
      setHistoryRecords([]);
      setLoading(false);
      setError('UID praktikan belum tersedia. Silakan login terlebih dahulu.');
      return undefined;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToStudentHistory(
      studentUid,
      records => {
        setHistoryRecords(records);
        setLoading(false);
        setError(null);
      },
      err => {
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [studentUid]);

  return {
    historyRecords,
    loading,
    error,
  };
}
