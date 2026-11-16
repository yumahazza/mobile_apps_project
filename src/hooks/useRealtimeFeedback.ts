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
  const [feedbacks, setFeedbacks] = useState<FeedbackRecordItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scheduleId?.trim()) {
      setFeedbacks([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToScheduleFeedbacks(
      scheduleId,
      items => {
        setFeedbacks(items);
        setLoading(false);
        setError(null);
      },
      err => {
        setFeedbacks([]);
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [scheduleId]);

  return { feedbacks, loading, error };
}

/**
 * Hook untuk Praktikan: Memeriksa apakah praktikan sudah mengirim feedback pada sesi ini.
 */
export function useStudentFeedback(scheduleId?: string, studentUid?: string) {
  const [feedback, setFeedback] = useState<FeedbackRecordItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scheduleId?.trim() || !studentUid?.trim()) {
      setFeedback(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToStudentFeedback(
      scheduleId,
      studentUid,
      item => {
        setFeedback(item);
        setLoading(false);
        setError(null);
      },
      err => {
        setFeedback(null);
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [scheduleId, studentUid]);

  return { feedback, loading, error };
}
