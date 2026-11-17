/**
 * Lintang — Session Control Service
 * SRS-AST-002: Kontrol sesi praktikum real-time dengan Cloud Firestore
 *
 * Mengelola transisi status sesi:
 * BELUM_DIBUKA -> DIBUKA -> SELESAI
 * Validasi atomik dengan Firestore Transaction untuk mencegah race condition.
 */
import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import {
  getFirestoreDb,
  getSafeAuthUid,
  getSafeFirestoreDb,
} from '@/services/firebaseClient';
import type { SessionStatus } from '@/data/schedules';
import type { PracticumSchedule } from '@/services/practicumScheduleService';

const SCHEDULES_COLLECTION = 'schedules';

export interface SessionControlResult {
  success: boolean;
  message: string;
  previousStatus?: SessionStatus;
  newStatus?: SessionStatus;
}

/**
 * Mendapatkan UID aktif dari Firebase Auth.
 * Jika belum login ke Firebase Auth, mengembalikan null.
 */
export function getActiveAuthUid(): string | null {
  return getSafeAuthUid();
}

/**
 * Membuka sesi praktikum secara atomik di Cloud Firestore.
 * Transisi yang sah: BELUM_DIBUKA -> DIBUKA.
 */
export async function openPracticumSession(
  scheduleId: string,
  callerAssistantUid?: string,
): Promise<SessionControlResult> {
  return changePracticumSessionStatus(scheduleId, 'DIBUKA', callerAssistantUid);
}

/**
 * Menutup sesi praktikum secara atomik di Cloud Firestore.
 * Transisi yang sah: DIBUKA -> SELESAI.
 */
export async function closePracticumSession(
  scheduleId: string,
  callerAssistantUid?: string,
): Promise<SessionControlResult> {
  return changePracticumSessionStatus(scheduleId, 'SELESAI', callerAssistantUid);
}

/**
 * Eksekusi perubahan status sesi praktikum dengan Firestore transaction.
 * Mencegah race condition dan memastikan validasi hak akses asisten.
 */
export async function changePracticumSessionStatus(
  scheduleId: string,
  targetStatus: 'DIBUKA' | 'SELESAI',
  callerAssistantUid?: string,
): Promise<SessionControlResult> {
  if (!scheduleId?.trim()) {
    throw new Error('ID jadwal praktikum tidak valid.');
  }

  // Periksa identitas asisten
  const authUid = getActiveAuthUid();
  const effectiveUid = callerAssistantUid || authUid;

  if (!effectiveUid) {
    throw new Error(
      'Autentikasi Firebase diperlukan. Silakan login sebagai asisten terlebih dahulu.',
    );
  }

  const db = getFirestoreDb();
  const scheduleDocRef = doc(db, SCHEDULES_COLLECTION, scheduleId);

  return runTransaction(db, async transaction => {
    const scheduleSnap = await transaction.get(scheduleDocRef);

    if (!scheduleSnap.exists()) {
      throw new Error('Dokumen jadwal praktikum tidak ditemukan di Firestore.');
    }

    const data = scheduleSnap.data() as Record<string, unknown>;
    const currentStatus = (data.status as SessionStatus) || 'BELUM_DIBUKA';
    const assignedAssistantId = String(data.assistantId ?? '');

    // Validasi 1: Hanya asisten penanggung jawab yang boleh mengontrol
    if (assignedAssistantId && assignedAssistantId !== effectiveUid) {
      throw new Error(
        'Akses ditolak: Anda bukan asisten yang ditugaskan pada sesi praktikum ini.',
      );
    }

    // Validasi 2: Aturan transisi status
    if (targetStatus === 'DIBUKA') {
      if (currentStatus === 'SELESAI') {
        throw new Error('Sesi yang telah SELESAI tidak dapat dibuka kembali.');
      }
      if (currentStatus === 'DIBUKA') {
        throw new Error('Sesi praktikum saat ini sudah dalam keadaan DIBUKA.');
      }
    } else if (targetStatus === 'SELESAI') {
      if (currentStatus === 'BELUM_DIBUKA') {
        throw new Error('Sesi BELUM_DIBUKA tidak dapat langsung ditutup/diselesaikan.');
      }
      if (currentStatus === 'SELESAI') {
        throw new Error('Sesi praktikum ini sudah ditutup sebelumnya.');
      }
    }

    // Tulis status baru secara atomik
    transaction.update(scheduleDocRef, {
      status: targetStatus,
      updatedAt: serverTimestamp(),
    });

    return {
      success: true,
      message:
        targetStatus === 'DIBUKA'
          ? 'Sesi praktikum berhasil dibuka. Mahasiswa dapat melakukan presensi.'
          : 'Sesi praktikum berhasil ditutup. Presensi telah dinonaktifkan.',
      previousStatus: currentStatus,
      newStatus: targetStatus,
    };
  });
}

/**
 * Berlangganan dokumen jadwal tunggal secara real-time.
 */
export function subscribeToSingleSchedule(
  scheduleId: string,
  onData: (schedule: PracticumSchedule | null) => void,
  onError: (message: string) => void,
): () => void {
  if (!scheduleId?.trim()) {
    onData(null);
    return () => undefined;
  }

  const db = getSafeFirestoreDb();
  if (!db) {
    onData(null);
    onError('Cloud Firestore belum siap. Gunakan Development Build Android/iOS.');
    return () => undefined;
  }

  const scheduleDocRef = doc(db, SCHEDULES_COLLECTION, scheduleId);

  return onSnapshot(
    scheduleDocRef,
    snapshot => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      const raw = snapshot.data() as Record<string, unknown>;
      onData({
        id: snapshot.id,
        courseName: String(raw.courseName ?? ''),
        className: String(raw.className ?? ''),
        room: String(raw.room ?? ''),
        date: String(raw.date ?? ''),
        time: String(raw.time ?? ''),
        status: (raw.status as SessionStatus) ?? 'BELUM_DIBUKA',
        assistantId: String(raw.assistantId ?? ''),
        assistantName: String(raw.assistantName ?? ''),
        enrolledStudents: Array.isArray(raw.enrolledStudents)
          ? raw.enrolledStudents.filter((uid): uid is string => typeof uid === 'string')
          : [],
        totalStudents: Number(raw.totalStudents ?? 0),
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      });
    },
    error => {
      onError(error.message || 'Gagal memuat dokumen sesi secara real-time.');
    },
  );
}
