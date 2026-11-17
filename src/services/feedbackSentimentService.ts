/**
 * Lintang — Feedback & AI Sentiment Analysis Service
 * SRS-STU-004: Pesan & kesan praktikan setelah praktikum selesai
 * SRS-AI-001: Analisis sentimen teks feedback (Positif, Negatif, Netral, Tidak Terklasifikasi)
 *
 * Catatan Arsitektur AI:
 * - Fritz mengelola `src/services/aiService.ts` untuk alasan izin. Service ini terisolasi
 *   khusus untuk klasifikasi pesan/kesan praktikan.
 * - Prioritas sumber inferensi:
 *   1. Dosen / Teacher API endpoint (jika EXPO_PUBLIC_AI_SENTIMENT_URL dikonfigurasi).
 *   2. Model lokal LinearSVC baseline (ai/model-edom.json + ai/sentiment.js).
 *   3. Fallback: 'Tidak Terklasifikasi' bila offline, timeout, atau kosakata tidak cocok.
 * - Pencegahan feedback ganda menggunakan Firestore Transaction pada feedbacks/${scheduleId}_${studentId}.
 */
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
} from '@react-native-firebase/firestore';
import {
  getFirestoreDb,
  getSafeAuthUid,
  getSafeFirestoreDb,
} from '@/services/firebaseClient';
import type {
  FeedbackRecordItem,
  SentimentLabel,
} from '@/types/attendance';
import { isDummyStudentId } from '@/services/attendanceService';

const FEEDBACKS_COLLECTION = 'feedbacks';
const SCHEDULES_COLLECTION = 'schedules';

export interface SentimentAnalysisResult {
  sentiment: SentimentLabel;
  source: 'teacher_api' | 'local_research_baseline' | 'fallback';
  rawOutput?: unknown;
}

export interface SubmitFeedbackInput {
  scheduleId: string;
  studentId: string;
  studentName: string;
  comment: string;
}

export interface SubmitFeedbackResponse {
  success: boolean;
  message: string;
  feedbackId: string;
  sentiment: SentimentLabel;
}

/**
 * Inisialisasi model lokal EDOM baseline secara aman.
 */
let localClassifier: ((text: string) => { label?: string; status?: string }) | null = null;
try {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { createSentimentClassifier } = require('../../ai/sentiment.js');
  const model = require('../../ai/model-edom.json');
  /* eslint-enable @typescript-eslint/no-require-imports */
  localClassifier = createSentimentClassifier(model);
} catch {
  localClassifier = null;
}

/**
 * Normalisasi label hasil AI ke kontrak resmi tim:
 * "Positif" | "Negatif" | "Netral" | "Tidak Terklasifikasi"
 */
export function normalizeSentimentLabel(rawLabel?: string | null): SentimentLabel {
  if (!rawLabel) return 'Tidak Terklasifikasi';
  const clean = String(rawLabel).toLowerCase().trim();
  if (clean === 'positif' || clean === 'positive') return 'Positif';
  if (clean === 'negatif' || clean === 'negative') return 'Negatif';
  if (clean === 'netral' || clean === 'neutral') return 'Netral';
  return 'Tidak Terklasifikasi';
}

/**
 * Menganalisis sentimen dari komentar pesan & kesan praktikum.
 * Tidak pernah melempar error agar pengiriman feedback praktikan tidak terblokir.
 */
export async function analyzeFeedbackSentiment(
  comment: string,
): Promise<SentimentAnalysisResult> {
  const trimmed = comment.trim();
  if (!trimmed) {
    return { sentiment: 'Tidak Terklasifikasi', source: 'fallback' };
  }

  // 1. Cek endpoint resmi pengajar jika tersedia via variabel lingkungan
  const teacherApiEndpoint =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_AI_SENTIMENT_URL
      ? process.env.EXPO_PUBLIC_AI_SENTIMENT_URL
      : null;

  if (teacherApiEndpoint) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(teacherApiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        const label = json.sentiment || json.label || json.prediction;
        const normalized = normalizeSentimentLabel(label);
        return {
          sentiment: normalized,
          source: 'teacher_api',
          rawOutput: json,
        };
      }
    } catch {
      // Endpoint pengajar gagal/timeout, lanjutkan ke model lokal
    }
  }

  // 2. Gunakan model lokal LinearSVC baseline jika tersedia
  if (localClassifier) {
    try {
      const pred = localClassifier(trimmed);
      if (pred && pred.status === 'predicted' && pred.label) {
        return {
          sentiment: normalizeSentimentLabel(pred.label),
          source: 'local_research_baseline',
          rawOutput: pred,
        };
      }
    } catch {
      // Model lokal gagal, gunakan fallback
    }
  }

  // 3. Fallback aman bila API dan model lokal tidak dapat mengklasifikasikan
  return {
    sentiment: 'Tidak Terklasifikasi',
    source: 'fallback',
  };
}

/**
 * Mengirimkan Pesan & Kesan praktikan setelah praktikum berstatus SELESAI.
 * Menggunakan Firestore Transaction untuk mencegah duplikasi feedback.
 */
export async function submitPracticumFeedback(
  input: SubmitFeedbackInput,
): Promise<SubmitFeedbackResponse> {
  const { scheduleId, studentId, studentName, comment } = input;

  if (!scheduleId?.trim()) {
    throw new Error('ID jadwal praktikum tidak valid.');
  }

  const cleanComment = comment.trim().replace(/\s+/g, ' ');

  if (!cleanComment) {
    throw new Error('Pesan & kesan tidak boleh kosong.');
  }

  if (cleanComment.length < 5) {
    throw new Error('Pesan & kesan terlalu pendek (minimal 5 karakter).');
  }

  if (cleanComment.length > 500) {
    throw new Error('Pesan & kesan terlalu panjang (maksimal 500 karakter).');
  }

  const effectiveStudentId = getSafeAuthUid();

  if (!effectiveStudentId?.trim()) {
    throw new Error(
      'Autentikasi diperlukan. Pengguna belum terautentikasi melalui Firebase Auth.',
    );
  }

  if (isDummyStudentId(effectiveStudentId)) {
    throw new Error(
      `ID "${effectiveStudentId}" merupakan dummy ID. Penyimpanan feedback memerlukan UID Firebase yang sah.`,
    );
  }

  // Lakukan klasifikasi AI sebelum penulisan database
  const aiResult = await analyzeFeedbackSentiment(cleanComment);
  const db = getFirestoreDb();
  const feedbackDocId = `${scheduleId}_${effectiveStudentId}`;
  const feedbackDocRef = doc(db, FEEDBACKS_COLLECTION, feedbackDocId);
  const scheduleDocRef = doc(db, SCHEDULES_COLLECTION, scheduleId);

  // 1. Validasi sesi di Firestore (tanpa runTransaction agar tidak memicu retry loop / deadline-exceeded)
  const scheduleSnap = await getDoc(scheduleDocRef);
  if (!scheduleSnap.exists()) {
    throw new Error('Sesi praktikum tidak ditemukan.');
  }

  const scheduleData = scheduleSnap.data() as Record<string, unknown>;
  const status = String(scheduleData.status ?? 'BELUM_DIBUKA');
  const enrolledStudents = Array.isArray(scheduleData.enrolledStudents)
    ? scheduleData.enrolledStudents
    : [];

  if (status !== 'SELESAI') {
    throw new Error(
      'Pesan & kesan hanya dapat diberikan setelah sesi praktikum dinyatakan SELESAI oleh asisten.',
    );
  }

  if (!enrolledStudents.includes(effectiveStudentId)) {
    throw new Error(
      'Anda tidak terdaftar sebagai peserta praktikum pada sesi ini.',
    );
  }

  // 2. Pencegahan feedback ganda (aman bila rules menolak get pada dokumen yang belum ada)
  let alreadyExists = false;
  try {
    const existingFeedbackSnap = await getDoc(feedbackDocRef);
    if (existingFeedbackSnap.exists()) {
      alreadyExists = true;
    }
  } catch {
    // Abaikan error baca pada dokumen yang belum ada; setDoc di bawah tetap dijaga allow create / allow update: false.
  }

  if (alreadyExists) {
    throw new Error(
      'Anda sudah mengirimkan pesan & kesan untuk sesi praktikum ini.',
    );
  }

  // 3. Simpan dokumen feedback secara langsung
  try {
    await setDoc(feedbackDocRef, {
      scheduleId,
      studentId: effectiveStudentId,
      studentName: studentName.trim() || 'Praktikan',
      comment: cleanComment,
      sentiment: aiResult.sentiment,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '';
    if (
      errMsg.includes('permission-denied') ||
      errMsg.includes('PERMISSION_DENIED')
    ) {
      throw new Error(
        'Anda sudah mengirimkan pesan & kesan untuk sesi praktikum ini.',
      );
    }
    throw err;
  }

  return {
    success: true,
    message: 'Pesan & kesan Anda berhasil tersimpan.',
    feedbackId: feedbackDocId,
    sentiment: aiResult.sentiment,
  };
}

/**
 * Berlangganan seluruh pesan & kesan untuk satu sesi (digunakan asisten pada rekap).
 */
export function subscribeToScheduleFeedbacks(
  scheduleId: string,
  onData: (feedbacks: FeedbackRecordItem[]) => void,
  onError: (message: string) => void,
): () => void {
  if (!scheduleId?.trim()) {
    onData([]);
    return () => undefined;
  }

  const db = getSafeFirestoreDb();
  if (!db) {
    onData([]);
    onError('Cloud Firestore belum siap. Gunakan Development Build Android/iOS.');
    return () => undefined;
  }

  const feedbacksQuery = query(
    collection(db, FEEDBACKS_COLLECTION),
    where('scheduleId', '==', scheduleId),
  );

  return onSnapshot(
    feedbacksQuery,
    snapshot => {
      const list: FeedbackRecordItem[] = snapshot.docs.map(itemDoc => {
        const raw = itemDoc.data() as Record<string, unknown>;
        let createdAtStr = '';
        if (
          raw.createdAt &&
          typeof (raw.createdAt as Timestamp).toDate ===
            'function'
        ) {
          createdAtStr = (
            raw.createdAt as Timestamp
          )
            .toDate()
            .toLocaleString('id-ID');
        }

        return {
          id: itemDoc.id,
          scheduleId: String(raw.scheduleId ?? ''),
          studentId: String(raw.studentId ?? ''),
          studentName: String(raw.studentName ?? ''),
          comment: String(raw.comment ?? ''),
          sentiment: normalizeSentimentLabel(raw.sentiment as string),
          createdAt: createdAtStr,
        };
      });

      onData(list);
    },
    error => {
      onError(error.message || 'Gagal memuat feedback sesi praktikum.');
    },
  );
}

/**
 * Berlangganan feedback praktikan tertentu pada satu sesi tertentu.
 */
export function subscribeToStudentFeedback(
  scheduleId: string,
  studentId: string,
  onData: (feedback: FeedbackRecordItem | null) => void,
  onError: (message: string) => void,
): () => void {
  if (!scheduleId?.trim() || !studentId?.trim()) {
    onData(null);
    return () => undefined;
  }

  const db = getSafeFirestoreDb();
  if (!db) {
    onData(null);
    onError('Cloud Firestore belum siap. Gunakan Development Build Android/iOS.');
    return () => undefined;
  }

  const feedbackDocId = `${scheduleId}_${studentId}`;
  const feedbackDocRef = doc(db, FEEDBACKS_COLLECTION, feedbackDocId);

  return onSnapshot(
    feedbackDocRef,
    snapshot => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }

      const raw = snapshot.data() as Record<string, unknown>;
      let createdAtStr = '';
      if (
        raw.createdAt &&
        typeof (raw.createdAt as Timestamp).toDate ===
          'function'
      ) {
        createdAtStr = (
          raw.createdAt as Timestamp
        )
          .toDate()
          .toLocaleString('id-ID');
      }

      onData({
        id: snapshot.id,
        scheduleId: String(raw.scheduleId ?? ''),
        studentId: String(raw.studentId ?? ''),
        studentName: String(raw.studentName ?? ''),
        comment: String(raw.comment ?? ''),
        sentiment: normalizeSentimentLabel(raw.sentiment as string),
        createdAt: createdAtStr,
      });
    },
    error => {
      onError(error.message || 'Gagal memuat feedback mahasiswa.');
    },
  );
}
