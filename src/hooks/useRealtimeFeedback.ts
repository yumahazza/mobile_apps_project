/**
 * Lintang — Hook Feedback & AI Sentiment Real-time
 * SRS-STU-004, SRS-AI-001
 *
 * Hooks untuk:
 * - Mendengarkan seluruh pesan & kesan suatu sesi (untuk rekap asisten)
 * - Mendengarkan feedback milik mahasiswa sendiri pada suatu sesi
 */
import { useEffect, useState } from 'react';
import type { FeedbackRecordItem } from '@/types/attendance';
import {
  subscribeToScheduleFeedbacks,
  subscribeToStudentFeedback,
} from '@/services/feedbackSentimentService';

/**
 * Hook untuk Asisten: Mengambil daftar feedback & hasil sentimen pada sesi tertentu.
 */
export function useScheduleFeedbacks(scheduleId?: string) {
  const activeKey = scheduleId?.trim() || '';
  const [state, setState] = useState<{
    key: string;
    feedbacks: FeedbackRecordItem[];
    error: string | null;
  }>({
    key: '',
    feedbacks: [],
    error: null,
  });

  useEffect(() => {
    if (!activeKey) {
      return undefined;
    }

    const targetKey = activeKey;
    const unsubscribe = subscribeToScheduleFeedbacks(
      targetKey,
      items => {
        setState({ key: targetKey, feedbacks: items, error: null });
      },
      err => {
        setState({ key: targetKey, feedbacks: [], error: err });
      },
    );

    return () => {
      unsubscribe();
    };
  }, [activeKey]);

  if (!activeKey) {
    return { feedbacks: [], loading: false, error: null };
  }

  return {
    feedbacks: state.key === activeKey ? state.feedbacks : [],
    loading: state.key !== activeKey,
    error: state.key === activeKey ? state.error : null,
  };
}

/**
 * Hook untuk Praktikan: Memeriksa apakah praktikan sudah mengirim feedback pada sesi ini.
 */
export function useStudentFeedback(scheduleId?: string, studentUid?: string) {
  const cleanScheduleId = scheduleId?.trim() || '';
  const cleanStudentUid = studentUid?.trim() || '';
  const activeKey =
    cleanScheduleId && cleanStudentUid ? `${cleanScheduleId}_${cleanStudentUid}` : '';
  const [state, setState] = useState<{
    key: string;
    feedback: FeedbackRecordItem | null;
    error: string | null;
  }>({
    key: '',
    feedback: null,
    error: null,
  });

  useEffect(() => {
    if (!activeKey) {
      return undefined;
    }

    const targetKey = activeKey;
    const unsubscribe = subscribeToStudentFeedback(
      cleanScheduleId,
      cleanStudentUid,
      item => {
        setState({ key: targetKey, feedback: item, error: null });
      },
      err => {
        setState({ key: targetKey, feedback: null, error: err });
      },
    );

    return () => {
      unsubscribe();
    };
  }, [activeKey, cleanScheduleId, cleanStudentUid]);

  if (!activeKey) {
    return { feedback: null, loading: false, error: null };
  }

  return {
    feedback: state.key === activeKey ? state.feedback : null,
    loading: state.key !== activeKey,
    error: state.key === activeKey ? state.error : null,
  };
}
