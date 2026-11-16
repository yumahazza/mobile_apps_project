/**
 * Fritz — Custom Hooks Pengajuan Izin Real-time (Sprint 2)
 *
 * Menggunakan onSnapshot dari leaveRequestService untuk:
 * 1. Praktikan: Memantau status pengajuan izin ('MENUNGGU', 'DITERIMA', 'DITOLAK') secara real-time.
 * 2. Asisten: Memantau daftar pengajuan izin per sesi beserta klasifikasi AI secara real-time.
 */

import { useEffect, useState } from 'react';
import type { LeaveRequestItem } from '@/types/leaveRequest';
import {
  subscribeToScheduleLeaveRequests,
  subscribeToStudentLeaveForSchedule,
  subscribeToStudentLeaveRequests,
} from '@/services/leaveRequestService';

export function useStudentLeaveForSchedule(
  scheduleId?: string,
  studentId?: string,
) {
  const hasParams = Boolean(scheduleId?.trim() && studentId?.trim());
  const [state, setState] = useState<{
    key: string;
    leaveRequest: LeaveRequestItem | null;
    error: string | null;
  }>({
    key: '',
    leaveRequest: null,
    error: null,
  });

  const currentKey = hasParams ? `${scheduleId}_${studentId}` : '';

  useEffect(() => {
    if (!scheduleId?.trim() || !studentId?.trim()) {
      return undefined;
    }

    const key = `${scheduleId}_${studentId}`;
    const unsubscribe = subscribeToStudentLeaveForSchedule(
      scheduleId,
      studentId,
      item => {
        setState({ key, leaveRequest: item, error: null });
      },
      err => {
        setState({ key, leaveRequest: null, error: err });
      },
    );

    return () => {
      unsubscribe();
    };
  }, [scheduleId, studentId]);

  if (!hasParams) {
    return { leaveRequest: null, loading: false, error: null };
  }

  return {
    leaveRequest: state.key === currentKey ? state.leaveRequest : null,
    loading: state.key !== currentKey,
    error: state.key === currentKey ? state.error : null,
  };
}

export function useStudentLeaveRequests(studentId?: string) {
  const hasUid = Boolean(studentId?.trim());
  const [state, setState] = useState<{
    uid: string;
    leaveRequests: LeaveRequestItem[];
    error: string | null;
  }>({
    uid: '',
    leaveRequests: [],
    error: null,
  });

  const currentUid = hasUid ? String(studentId) : '';

  useEffect(() => {
    if (!studentId?.trim()) {
      return undefined;
    }

    const uid = studentId;
    const unsubscribe = subscribeToStudentLeaveRequests(
      studentId,
      items => {
        setState({ uid, leaveRequests: items, error: null });
      },
      err => {
        setState({ uid, leaveRequests: [], error: err });
      },
    );

    return () => {
      unsubscribe();
    };
  }, [studentId]);

  if (!hasUid) {
    return { leaveRequests: [], loading: false, error: null };
  }

  return {
    leaveRequests: state.uid === currentUid ? state.leaveRequests : [],
    loading: state.uid !== currentUid,
    error: state.uid === currentUid ? state.error : null,
  };
}

export function useScheduleLeaveRequests(scheduleId?: string) {
  const hasSchedule = Boolean(scheduleId?.trim());
  const [state, setState] = useState<{
    scheduleId: string;
    leaveRequests: LeaveRequestItem[];
    error: string | null;
  }>({
    scheduleId: '',
    leaveRequests: [],
    error: null,
  });

  const currentId = hasSchedule ? String(scheduleId) : '';

  useEffect(() => {
    if (!scheduleId?.trim()) {
      return undefined;
    }

    const targetId = scheduleId;
    const unsubscribe = subscribeToScheduleLeaveRequests(
      scheduleId,
      items => {
        setState({ scheduleId: targetId, leaveRequests: items, error: null });
      },
      err => {
        setState({ scheduleId: targetId, leaveRequests: [], error: err });
      },
    );

    return () => {
      unsubscribe();
    };
  }, [scheduleId]);

  const activeItems = state.scheduleId === currentId ? state.leaveRequests : [];
  const pendingCount = activeItems.filter(r => r.status === 'MENUNGGU').length;
  const approvedCount = activeItems.filter(r => r.status === 'DITERIMA').length;
  const rejectedCount = activeItems.filter(r => r.status === 'DITOLAK').length;

  if (!hasSchedule) {
    return {
      leaveRequests: [],
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      loading: false,
      error: null,
    };
  }

  return {
    leaveRequests: activeItems,
    pendingCount,
    approvedCount,
    rejectedCount,
    loading: state.scheduleId !== currentId,
    error: state.scheduleId === currentId ? state.error : null,
  };
}
