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
  const activeKey = studentUid?.trim() || '';
  const [state, setState] = useState<{
    key: string;
    historyRecords: AttendanceRecordItem[];
    error: string | null;
  }>({
    key: '',
    historyRecords: [],
    error: null,
  });

  useEffect(() => {
    if (!activeKey) {
      return undefined;
    }

    const targetKey = activeKey;
    const unsubscribe = subscribeToStudentHistory(
      targetKey,
      records => {
        setState({ key: targetKey, historyRecords: records, error: null });
      },
      err => {
        setState({ key: targetKey, historyRecords: [], error: err });
      },
    );

    return () => {
      unsubscribe();
    };
  }, [activeKey]);

  if (!activeKey) {
    return {
      historyRecords: [],
      loading: false,
      error: 'UID praktikan belum tersedia. Silakan login terlebih dahulu.',
    };
  }

  return {
    historyRecords: state.key === activeKey ? state.historyRecords : [],
    loading: state.key !== activeKey,
    error: state.key === activeKey ? state.error : null,
  };
}
