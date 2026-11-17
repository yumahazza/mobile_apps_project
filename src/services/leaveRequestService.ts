/**
 * Fritz — Leave Request & Assistant Approval Service (Sprint 2)
 *
 * Mengelola pengajuan izin ketidakhadiran praktikan secara real-time di Cloud Firestore:
 * - Koleksi: leave_requests
 * - Document ID: ${scheduleId}_${studentId} (mencegah pengajuan izin ganda pada sesi yang sama)
 * - Status awal selalu 'MENUNGGU' (AI hanya mengklasifikasi alasan, keputusan 100% di tangan Asisten)
 * - Ketika Asisten menyetujui ('DITERIMA'), otomatis menyinkronkan status 'Izin' ke koleksi `attendances`
 */

import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Timestamp,
  type Firestore,
} from '@react-native-firebase/firestore';
import {
  getSafeAuthUid,
  getSafeFirestoreDb,
} from '@/services/firebaseClient';
import type {
  LeaveAIStatus,
  LeaveRequestItem,
  LeaveRequestStatus,
  LeaveUrgencyLevel,
} from '@/types/leaveRequest';
import {
  classifyLeaveReason,
  FALLBACK_AI_CLASSIFICATION,
  FALLBACK_AI_SUMMARY,
  type ClassifyLeaveOptions,
} from '@/services/aiService';
import {
  formatIndonesianDate,
  formatIndonesianTime,
  isDummyStudentId,
  parseFirestoreTimestampToString,
} from '@/services/attendanceService';

const LEAVE_REQUESTS_COLLECTION = 'leave_requests';
const ATTENDANCES_COLLECTION = 'attendances';
const SCHEDULES_COLLECTION = 'schedules';

// Penyimpanan reaktif lokal sebagai fallback aman saat diuji di Web / Expo Go tanpa native Firebase build
const localLeaveStore = new Map<string, LeaveRequestItem>();
const localListeners = new Set<() => void>();

function notifyLocalListeners() {
  localListeners.forEach(listener => {
    try {
      listener();
    } catch {
      // Abaikan error listener
    }
  });
}

function getSafeFirestore(): Firestore | null {
  return getSafeFirestoreDb();
}

export interface SubmitLeaveRequestInput {
  scheduleId: string;
  courseName?: string;
  className?: string;
  studentId: string;
  studentName: string;
  nim?: string;
  reason: string;
  aiOptions?: ClassifyLeaveOptions;
}

export interface SubmitLeaveRequestResponse {
  success: boolean;
  message: string;
  leaveRequestId: string;
  aiClassification: string;
  aiStatus: LeaveAIStatus;
  status: LeaveRequestStatus;
}

export interface ReviewLeaveRequestInput {
  scheduleId: string;
  studentId: string;
  decision: 'DITERIMA' | 'DITOLAK';
  assistantId: string;
  assistantName?: string;
}

export interface ReviewLeaveRequestResponse {
  success: boolean;
  message: string;
  leaveRequestId: string;
  status: 'DITERIMA' | 'DITOLAK';
}

/**
 * Validasi alasan izin sebelum dikirim ke Firestore.
 */
export function validateLeaveReason(reason: string): string | null {
  const trimmed = (reason || '').trim();
  if (!trimmed) {
    return 'Alasan izin wajib diisi.';
  }
  if (trimmed.length < 5) {
    return 'Alasan izin minimal 5 karakter agar dapat diperiksa asisten.';
  }
  if (trimmed.length > 500) {
    return 'Alasan izin maksimal 500 karakter.';
  }
  return null;
}

/**
 * Pemetaan dokumen mentah Firestore ke struktur LeaveRequestItem untuk UI.
 */
export function mapFirestoreLeaveRequest(
  docId: string,
  raw: Record<string, unknown>,
): LeaveRequestItem {
  const createdParsed = parseFirestoreTimestampToString(raw.createdAt);
  const reviewedParsed = raw.reviewedAt
    ? parseFirestoreTimestampToString(raw.reviewedAt)
    : null;

  const aiStatus: LeaveAIStatus =
    raw.aiStatus === 'SUCCESS' || raw.aiStatus === 'FALLBACK'
      ? raw.aiStatus
      : 'FALLBACK';

  const status: LeaveRequestStatus =
    raw.status === 'DITERIMA' || raw.status === 'DITOLAK' || raw.status === 'MENUNGGU'
      ? raw.status
      : 'MENUNGGU';

  const aiUrgency: LeaveUrgencyLevel =
    raw.aiUrgency === 'Tinggi' ||
    raw.aiUrgency === 'Sedang' ||
    raw.aiUrgency === 'Rendah' ||
    raw.aiUrgency === 'Perlu Cek Manual'
      ? raw.aiUrgency
      : aiStatus === 'FALLBACK'
      ? 'Perlu Cek Manual'
      : 'Sedang';

  return {
    id: docId,
    scheduleId: String(raw.scheduleId ?? ''),
    courseName: raw.courseName ? String(raw.courseName) : undefined,
    className: raw.className ? String(raw.className) : undefined,
    studentId: String(raw.studentId ?? ''),
    studentName: String(raw.studentName ?? 'Praktikan'),
    nim: String(raw.nim ?? '-'),
    reason: String(raw.reason ?? ''),
    aiClassification: String(raw.aiClassification || FALLBACK_AI_CLASSIFICATION),
    aiStatus,
    aiUrgency,
    aiSummary: String(raw.aiSummary || FALLBACK_AI_SUMMARY),
    status,
    reviewedBy: raw.reviewedBy ? String(raw.reviewedBy) : null,
    reviewedAt: reviewedParsed
      ? `${reviewedParsed.dateStr} • ${reviewedParsed.timeStr}`
      : null,
    createdAt: `${createdParsed.dateStr} • ${createdParsed.timeStr}`,
    rawCreatedAt: (raw.createdAt as Timestamp) || null,
  };
}

/**
 * PENGAJUAN IZIN OLEH PRAKTIKAN (Kebutuhan #9 & #10)
 * 1. Memvalidasi input alasan izin & UID mahasiswa
 * 2. Menjalankan klasifikasi AI pada alasan izin (dengan fallback otomatis jika AI gagal/timeout)
 * 3. Menggunakan Firestore Transaction pada `leave_requests/${scheduleId}_${studentId}`:
 *    - Mencegah pengajuan izin ganda pada sesi yang sama
 *    - Mencegah pengajuan izin jika mahasiswa sudah tercatat Hadir
 *    - Menyimpan dokumen dengan status awal 'MENUNGGU'
 */
export async function submitLeaveRequest(
  input: SubmitLeaveRequestInput,
): Promise<SubmitLeaveRequestResponse> {
  const {
    scheduleId,
    courseName,
    className,
    studentId,
    studentName,
    nim,
    reason,
    aiOptions,
  } = input;

  if (!scheduleId?.trim()) {
    throw new Error('ID jadwal praktikum tidak valid.');
  }

  const validationError = validateLeaveReason(reason);
  if (validationError) {
    throw new Error(validationError);
  }

  const authUid = getSafeAuthUid();

  const effectiveStudentId = authUid || studentId;
  if (!effectiveStudentId?.trim()) {
    throw new Error(
      'Autentikasi diperlukan. Pengguna belum terautentikasi melalui Firebase Auth.',
    );
  }

  const trimmedReason = reason.trim();

  // Klasifikasi AI dilakukan di luar transaction; tidak pernah melempar error (memiliki fallback)
  const aiResult = await classifyLeaveReason(trimmedReason, aiOptions);
  const leaveDocId = `${scheduleId}_${effectiveStudentId}`;

  const db = getSafeFirestore();
  const useLocalFallback = !db || isDummyStudentId(effectiveStudentId);

  if (!useLocalFallback && db) {
    try {
      const leaveDocRef = doc(db, LEAVE_REQUESTS_COLLECTION, leaveDocId);
      const attendanceDocRef = doc(db, ATTENDANCES_COLLECTION, leaveDocId);
      const scheduleDocRef = doc(db, SCHEDULES_COLLECTION, scheduleId);

      await runTransaction(db, async transaction => {
        const scheduleSnap = await transaction.get(scheduleDocRef);
        if (!scheduleSnap.exists()) {
          throw new Error('Jadwal praktikum tidak ditemukan di Firestore.');
        }

        const scheduleData = scheduleSnap.data() as Record<string, unknown>;
        const scheduleStatus = String(scheduleData.status ?? 'BELUM_DIBUKA');
        if (scheduleStatus === 'SELESAI') {
          throw new Error(
            'Pengajuan izin gagal: Sesi praktikum telah selesai dan ditutup.',
          );
        }

        const enrolledStudents = Array.isArray(scheduleData.enrolledStudents)
          ? scheduleData.enrolledStudents
          : [];
        if (
          enrolledStudents.length > 0 &&
          !enrolledStudents.includes(effectiveStudentId)
        ) {
          throw new Error(
            'Pengajuan izin gagal: Akun Anda tidak terdaftar sebagai peserta sesi praktikum ini.',
          );
        }

        // Cek apakah sudah presensi hadir
        const existingAttendanceSnap = await transaction.get(attendanceDocRef);
        if (existingAttendanceSnap.exists()) {
          const attData = existingAttendanceSnap.data() as Record<string, unknown>;
          if (attData?.status === 'Hadir') {
            throw new Error(
              'Anda sudah tercatat Hadir pada sesi praktikum ini, tidak dapat mengajukan izin.',
            );
          }
        }

        // Cek pengajuan izin ganda (ATOMIC CHECK)
        const existingLeaveSnap = await transaction.get(leaveDocRef);
        if (existingLeaveSnap.exists()) {
          throw new Error(
            'Anda sudah mengajukan izin pada sesi praktikum ini sebelumnya.',
          );
        }

        // Simpan pengajuan izin dengan status awal wajib 'MENUNGGU'
        transaction.set(leaveDocRef, {
          id: leaveDocId,
          scheduleId,
          courseName: String(scheduleData.courseName ?? courseName ?? ''),
          className: String(scheduleData.className ?? className ?? ''),
          studentId: effectiveStudentId,
          studentName: studentName.trim() || 'Praktikan',
          nim: nim?.trim() || '-',
          reason: trimmedReason,
          aiClassification: aiResult.aiClassification,
          aiStatus: aiResult.aiStatus,
          aiUrgency: aiResult.urgency,
          aiSummary: aiResult.summary,
          status: 'MENUNGGU',
          reviewedBy: null,
          reviewedAt: null,
          createdAt: serverTimestamp(),
        });
      });

      return {
        success: true,
        message:
          aiResult.aiStatus === 'SUCCESS'
            ? `Pengajuan izin berhasil dikirim (Klasifikasi AI: ${aiResult.aiClassification}) dan sedang menunggu persetujuan asisten.`
            : 'Pengajuan izin berhasil dikirim (AI perlu cek manual) dan sedang menunggu persetujuan asisten.',
        leaveRequestId: leaveDocId,
        aiClassification: aiResult.aiClassification,
        aiStatus: aiResult.aiStatus,
        status: 'MENUNGGU',
      };
    } catch (err) {
      // Jika transaksi Firestore gagal, tampilkan error sebenarnya.
      // Jangan menganggap data berhasil disimpan secara lokal.
      console.error('[submitLeaveRequest] Firestore error:', err);
      throw err;
    }
  }

  // Penyimpanan reaktif lokal (untuk pengujian di Expo Go / Web sebelum native Firebase Auth aktif)
  if (localLeaveStore.has(leaveDocId)) {
    throw new Error(
      'Anda sudah mengajukan izin pada sesi praktikum ini sebelumnya.',
    );
  }

  const now = new Date();
  const createdStr = `${formatIndonesianDate(now)} • ${formatIndonesianTime(now)}`;
  localLeaveStore.set(leaveDocId, {
    id: leaveDocId,
    scheduleId,
    courseName,
    className,
    studentId: effectiveStudentId,
    studentName: studentName.trim() || 'Praktikan',
    nim: nim?.trim() || '-',
    reason: trimmedReason,
    aiClassification: aiResult.aiClassification,
    aiStatus: aiResult.aiStatus,
    aiUrgency: aiResult.urgency,
    aiSummary: aiResult.summary,
    status: 'MENUNGGU',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: createdStr,
    rawCreatedAt: null,
  });
  notifyLocalListeners();

  return {
    success: true,
    message:
      aiResult.aiStatus === 'SUCCESS'
        ? `Pengajuan izin berhasil dikirim (Klasifikasi AI: ${aiResult.aiClassification}) dan sedang menunggu persetujuan asisten.`
        : 'Pengajuan izin berhasil dikirim (AI perlu cek manual) dan sedang menunggu persetujuan asisten.',
    leaveRequestId: leaveDocId,
    aiClassification: aiResult.aiClassification,
    aiStatus: aiResult.aiStatus,
    status: 'MENUNGGU',
  };
}

/**
 * PEMERIKSAAN & KEPUTUSAN IZIN OLEH ASISTEN (Kebutuhan #11)
 * - Mengubah status pengajuan izin menjadi 'DITERIMA' atau 'DITOLAK'
 * - Jika 'DITERIMA', menyinkronkan dokumen kehadiran ke koleksi `attendances/${scheduleId}_${studentId}`
 *   dengan status: 'Izin' agar rekap presensi asisten & riwayat praktikan otomatis ter-update.
 */
export async function reviewLeaveRequest(
  input: ReviewLeaveRequestInput,
): Promise<ReviewLeaveRequestResponse> {
  const { scheduleId, studentId, decision, assistantId, assistantName } = input;

  if (!scheduleId?.trim() || !studentId?.trim()) {
    throw new Error('ID jadwal atau ID praktikan tidak valid.');
  }

  if (decision !== 'DITERIMA' && decision !== 'DITOLAK') {
    throw new Error('Keputusan izin harus DITERIMA atau DITOLAK.');
  }

  const authUid = getSafeAuthUid();

  const effectiveAssistantId = authUid || assistantId || 'assistant';
  const leaveDocId = `${scheduleId}_${studentId}`;
  const reviewerLabel = assistantName?.trim()
    ? `${assistantName.trim()}`
    : effectiveAssistantId;

  const db = getSafeFirestore();
  const useLocalFallback =
    !db || isDummyStudentId(effectiveAssistantId) || localLeaveStore.has(leaveDocId);

  if (!useLocalFallback && db) {
    try {
      const leaveDocRef = doc(db, LEAVE_REQUESTS_COLLECTION, leaveDocId);
      const attendanceDocRef = doc(db, ATTENDANCES_COLLECTION, leaveDocId);
      const scheduleDocRef = doc(db, SCHEDULES_COLLECTION, scheduleId);
      const dateFormatted = formatIndonesianDate(new Date());

      await runTransaction(db, async transaction => {
        const leaveSnap = await transaction.get(leaveDocRef);
        if (!leaveSnap.exists()) {
          throw new Error('Data pengajuan izin tidak ditemukan di Firestore.');
        }

        const scheduleSnap = await transaction.get(scheduleDocRef);
        if (scheduleSnap.exists()) {
          const scheduleData = scheduleSnap.data() as Record<string, unknown>;
          const ownerAssistantId = String(scheduleData.assistantId ?? '');
          if (ownerAssistantId && ownerAssistantId !== effectiveAssistantId) {
            throw new Error(
              'Akses ditolak: Hanya asisten pengampu jadwal ini yang dapat memproses izin.',
            );
          }
        }
        const attendanceSnap = await transaction.get(attendanceDocRef);
        const leaveData = leaveSnap.data() as Record<string, unknown>;

        // Pengajuan hanya boleh diputuskan satu kali.
        if (leaveData.status !== 'MENUNGGU') {
          throw new Error(
            'Pengajuan izin ini sudah diproses dan tidak dapat diputuskan ulang.',
          );
        }

        transaction.update(leaveDocRef, {

          status: decision,
          reviewedBy: reviewerLabel,
          reviewedAt: serverTimestamp(),
        });

        if (decision === 'DITERIMA') {
          const existingAttStatus = attendanceSnap.exists()
            ? String((attendanceSnap.data() as Record<string, unknown>)?.status ?? '')
            : '';

          if (existingAttStatus === 'Hadir') {
            throw new Error(
              'Pengajuan tidak dapat diterima karena praktikan sudah tercatat Hadir.',
            );
          }

          if (!attendanceSnap.exists()) {
            transaction.set(attendanceDocRef, {
              scheduleId,
              studentId,
              studentName: String(leaveData.studentName ?? 'Praktikan'),
              nim: String(leaveData.nim ?? '-'),
              timestamp: serverTimestamp(),
              date: dateFormatted,
              status: 'Izin',
            });
          }
        }
      });

      return {
        success: true,
        message:
          decision === 'DITERIMA'
            ? 'Pengajuan izin DITERIMA dan status Izin telah disinkronkan ke rekap presensi.'
            : 'Pengajuan izin telah DITOLAK.',
        leaveRequestId: leaveDocId,
        status: decision,
      };
    } catch (err) {
      console.error('[reviewLeaveRequest] Firestore error:', err);
      throw err;
    }
  }

  // Update di local store reaktif jika berjalan di mode simulasi lokal
  const existingLocal = localLeaveStore.get(leaveDocId);
  if (!existingLocal) {
    throw new Error('Data pengajuan izin tidak ditemukan.');
  }

  const now = new Date();
  localLeaveStore.set(leaveDocId, {
    ...existingLocal,
    status: decision,
    reviewedBy: reviewerLabel,
    reviewedAt: `${formatIndonesianDate(now)} • ${formatIndonesianTime(now)}`,
  });
  notifyLocalListeners();

  return {
    success: true,
    message:
      decision === 'DITERIMA'
        ? 'Pengajuan izin DITERIMA dan status Izin telah diperbarui.'
        : 'Pengajuan izin telah DITOLAK.',
    leaveRequestId: leaveDocId,
    status: decision,
  };
}

/**
 * Berlangganan status pengajuan izin satu praktikan pada satu sesi secara real-time (onSnapshot).
 */
export function subscribeToStudentLeaveForSchedule(
  scheduleId: string,
  studentId: string,
  onData: (leave: LeaveRequestItem | null) => void,
  onError: (message: string) => void,
): () => void {
  if (!scheduleId?.trim() || !studentId?.trim()) {
    onData(null);
    return () => undefined;
  }

  const leaveDocId = `${scheduleId}_${studentId}`;
  const emitLocal = () => {
    onData(localLeaveStore.get(leaveDocId) ?? null);
  };
  localListeners.add(emitLocal);

  const db = getSafeFirestore();
  if (!db || isDummyStudentId(studentId)) {
    emitLocal();
    return () => {
      localListeners.delete(emitLocal);
    };
  }

  let unsubFirestore: (() => void) | null = null;
  try {
    const leaveDocRef = doc(db, LEAVE_REQUESTS_COLLECTION, leaveDocId);
    unsubFirestore = onSnapshot(
      leaveDocRef,
      snapshot => {
        if (!snapshot.exists()) {
          onData(localLeaveStore.get(leaveDocId) ?? null);
          return;
        }
        const raw = snapshot.data() as Record<string, unknown>;
        onData(mapFirestoreLeaveRequest(snapshot.id, raw));
      },
      error => {
        if (localLeaveStore.has(leaveDocId)) {
          emitLocal();
        } else {
          onError(error.message || 'Gagal memuat status pengajuan izin.');
        }
      },
    );
  } catch {
    emitLocal();
  }

  return () => {
    localListeners.delete(emitLocal);
    if (unsubFirestore) unsubFirestore();
  };
}

/**
 * Berlangganan seluruh daftar pengajuan izin milik seorang praktikan secara real-time.
 */
export function subscribeToStudentLeaveRequests(
  studentId: string,
  onData: (items: LeaveRequestItem[]) => void,
  onError: (message: string) => void,
): () => void {
  if (!studentId?.trim()) {
    onData([]);
    return () => undefined;
  }

  const emitLocal = () => {
    const list = Array.from(localLeaveStore.values()).filter(
      item => item.studentId === studentId,
    );
    onData(list);
  };
  localListeners.add(emitLocal);

  const db = getSafeFirestore();
  if (!db || isDummyStudentId(studentId)) {
    emitLocal();
    return () => {
      localListeners.delete(emitLocal);
    };
  }

  let unsubFirestore: (() => void) | null = null;
  try {
    const q = query(
      collection(db, LEAVE_REQUESTS_COLLECTION),
      where('studentId', '==', studentId),
    );

    unsubFirestore = onSnapshot(
      q,
      snapshot => {
        const items = snapshot.docs.map(docSnap =>
          mapFirestoreLeaveRequest(
            docSnap.id,
            docSnap.data() as Record<string, unknown>,
          ),
        );
        items.sort((a, b) => {
          const tA = a.rawCreatedAt?.toMillis?.() ?? 0;
          const tB = b.rawCreatedAt?.toMillis?.() ?? 0;
          return tB - tA;
        });
        onData(items.length > 0 ? items : Array.from(localLeaveStore.values()).filter(i => i.studentId === studentId));
      },
      error => {
        const localItems = Array.from(localLeaveStore.values()).filter(
          i => i.studentId === studentId,
        );
        if (localItems.length > 0) {
          onData(localItems);
        } else {
          onError(error.message || 'Gagal memuat riwayat pengajuan izin praktikan.');
        }
      },
    );
  } catch {
    emitLocal();
  }

  return () => {
    localListeners.delete(emitLocal);
    if (unsubFirestore) unsubFirestore();
  };
}

/**
 * Berlangganan seluruh pengajuan izin pada satu sesi praktikum secara real-time (untuk Asisten).
 */
export function subscribeToScheduleLeaveRequests(
  scheduleId: string,
  onData: (items: LeaveRequestItem[]) => void,
  onError: (message: string) => void,
): () => void {
  if (!scheduleId?.trim()) {
    onData([]);
    return () => undefined;
  }

  const emitLocal = () => {
    const list = Array.from(localLeaveStore.values()).filter(
      item => item.scheduleId === scheduleId,
    );
    onData(list);
  };
  localListeners.add(emitLocal);

  const db = getSafeFirestore();
  if (!db) {
    emitLocal();
    return () => {
      localListeners.delete(emitLocal);
    };
  }

  let unsubFirestore: (() => void) | null = null;
  try {
    const q = query(
      collection(db, LEAVE_REQUESTS_COLLECTION),
      where('scheduleId', '==', scheduleId),
    );

    unsubFirestore = onSnapshot(
      q,
      snapshot => {
        const firestoreItems = snapshot.docs.map(docSnap =>
          mapFirestoreLeaveRequest(
            docSnap.id,
            docSnap.data() as Record<string, unknown>,
          ),
        );
        const localItems = Array.from(localLeaveStore.values()).filter(
          item =>
            item.scheduleId === scheduleId &&
            !firestoreItems.some(f => f.id === item.id),
        );
        const combined = [...firestoreItems, ...localItems];
        combined.sort((a, b) => {
          if (a.status === 'MENUNGGU' && b.status !== 'MENUNGGU') return -1;
          if (a.status !== 'MENUNGGU' && b.status === 'MENUNGGU') return 1;
          const tA = a.rawCreatedAt?.toMillis?.() ?? 0;
          const tB = b.rawCreatedAt?.toMillis?.() ?? 0;
          return tB - tA;
        });
        onData(combined);
      },
      error => {
        const localItems = Array.from(localLeaveStore.values()).filter(
          item => item.scheduleId === scheduleId,
        );
        if (localItems.length > 0) {
          onData(localItems);
        } else {
          onError(error.message || 'Gagal memuat daftar pengajuan izin sesi ini.');
        }
      },
    );
  } catch {
    emitLocal();
  }

  return () => {
    localListeners.delete(emitLocal);
    if (unsubFirestore) unsubFirestore();
  };
}
