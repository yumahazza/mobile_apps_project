/**
 * Lintang — Attendance Service
 * SRS-STU-001, SRS-STU-002, SRS-STU-003, SRS-AST-003
 *
 * Mengelola presensi praktikan real-time dengan Cloud Firestore:
 * - Koleksi: attendances
 * - Doc ID: ${scheduleId}_${studentId}
 * - Pencegahan presensi ganda secara atomik menggunakan Firestore Transaction
 * - Timestamp server & waktu format Indonesia
 */
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Timestamp,
} from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import type {
  AttendanceRecordItem,
  AttendanceStats,
} from '@/types/attendance';

const db = getFirestore();
const ATTENDANCES_COLLECTION = 'attendances';
const SCHEDULES_COLLECTION = 'schedules';

export interface SubmitAttendanceInput {
  scheduleId: string;
  studentId: string;
  studentName: string;
  nim?: string;
}

export interface SubmitAttendanceResponse {
  success: boolean;
  message: string;
  timestamp: string;
  attendanceId: string;
}

/**
 * Format tanggal Indonesia: "16 Nov 2026"
 */
export function formatIndonesianDate(d: Date = new Date()): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format jam Indonesia: "10:15:30 WIB"
 */
export function formatIndonesianTime(d: Date = new Date()): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss} WIB`;
}

/**
 * Konversi Firestore Timestamp ke string format waktu Indonesia
 */
export function parseFirestoreTimestampToString(
  rawTs: unknown,
  fallbackDate?: string,
): { timeStr: string; dateStr: string } {
  if (rawTs && typeof (rawTs as Timestamp).toDate === 'function') {
    const dateObj = (rawTs as Timestamp).toDate();
    return {
      timeStr: formatIndonesianTime(dateObj),
      dateStr: formatIndonesianDate(dateObj),
    };
  }
  return {
    timeStr: formatIndonesianTime(),
    dateStr: fallbackDate || formatIndonesianDate(),
  };
}

/**
 * Memeriksa apakah studentId merupakan ID dummy yang dilarang.
 */
export function isDummyStudentId(id?: string): boolean {
  if (!id) return true;
  return /^(stu-\d+|ast-\d+|demo-|dummy-)/i.test(id.trim());
}

/**
 * SUBMIT PRESENSI PRAKTIKAN
 * Menjalankan Firestore transaction untuk:
 * 1. Memeriksa jadwal ada dan berstatus 'DIBUKA'
 * 2. Memeriksa mahasiswa terdaftar di 'enrolledStudents'
 * 3. Memeriksa dokumen attendances/${scheduleId}_${studentId} belum ada
 * 4. Menyimpan dokumen presensi baru secara permanen
 */
export async function submitPracticumAttendance(
  input: SubmitAttendanceInput,
): Promise<SubmitAttendanceResponse> {
  const { scheduleId, studentId, studentName, nim } = input;

  if (!scheduleId?.trim()) {
    throw new Error('ID jadwal praktikum tidak valid.');
  }

  // Identitas Firebase Auth
  let authUid: string | null = null;
  try {
    authUid = getAuth().currentUser?.uid ?? null;
  } catch {
    authUid = null;
  }

  const effectiveStudentId = authUid;

  if (!effectiveStudentId?.trim()) {
    throw new Error(
      'Autentikasi diperlukan. Pengguna belum terautentikasi melalui Firebase Auth.',
    );
  }

  if (isDummyStudentId(effectiveStudentId)) {
    throw new Error(
      `ID "${effectiveStudentId}" merupakan dummy ID. Presensi Firestore mewajibkan UID autentikasi Firebase yang sah.`,
    );
  }

  const attendanceDocId = `${scheduleId}_${effectiveStudentId}`;
  const attendanceDocRef = doc(db, ATTENDANCES_COLLECTION, attendanceDocId);
  const scheduleDocRef = doc(db, SCHEDULES_COLLECTION, scheduleId);

  const localNow = new Date();
  const dateFormatted = formatIndonesianDate(localNow);
  const timeFormatted = formatIndonesianTime(localNow);

  await runTransaction(db, async transaction => {
    // 1. Baca dokumen jadwal
    const scheduleSnap = await transaction.get(scheduleDocRef);
    if (!scheduleSnap.exists()) {
      throw new Error('Jadwal praktikum tidak ditemukan di Firestore.');
    }

    const scheduleData = scheduleSnap.data() as Record<string, unknown>;
    const status = String(scheduleData.status ?? 'BELUM_DIBUKA');
    const enrolledStudents = Array.isArray(scheduleData.enrolledStudents)
      ? scheduleData.enrolledStudents
      : [];

    // 2. Validasi status sesi
    if (status !== 'DIBUKA') {
      if (status === 'BELUM_DIBUKA') {
        throw new Error('Presensi gagal: Sesi praktikum belum dibuka oleh asisten.');
      }
      throw new Error('Presensi gagal: Sesi praktikum telah ditutup.');
    }

    // 3. Validasi keikutsertaan mahasiswa
    if (!enrolledStudents.includes(effectiveStudentId)) {
      throw new Error(
        'Anda tidak terdaftar sebagai peserta praktikum pada sesi ini.',
      );
    }

    // 4. Validasi presensi ganda di database (ATOMIC CHECK)
    const existingAttendanceSnap = await transaction.get(attendanceDocRef);
    if (existingAttendanceSnap.exists()) {
      throw new Error('Anda sudah melakukan presensi pada sesi ini sebelumnya.');
    }

    // 5. Simpan dokumen kehadiran
    transaction.set(attendanceDocRef, {
      scheduleId,
      studentId: effectiveStudentId,
      studentName: studentName.trim() || 'Praktikan',
      nim: nim?.trim() || '-',
      timestamp: serverTimestamp(),
      date: dateFormatted,
      status: 'Hadir',
    });
  });

  return {
    success: true,
    message: `Presensi berhasil dicatat pada pukul ${timeFormatted}.`,
    timestamp: timeFormatted,
    attendanceId: attendanceDocId,
  };
}

/**
 * Berlangganan daftar presensi real-time untuk satu sesi (digunakan asisten).
 */
export function subscribeToScheduleAttendances(
  scheduleId: string,
  onData: (attendances: AttendanceRecordItem[]) => void,
  onError: (message: string) => void,
): () => void {
  if (!scheduleId?.trim()) {
    onData([]);
    return () => undefined;
  }

  const attendancesQuery = query(
    collection(db, ATTENDANCES_COLLECTION),
    where('scheduleId', '==', scheduleId),
  );

  return onSnapshot(
    attendancesQuery,
    snapshot => {
      const records: AttendanceRecordItem[] = snapshot.docs.map(itemDoc => {
        const raw = itemDoc.data() as Record<string, unknown>;
        const { timeStr, dateStr } = parseFirestoreTimestampToString(
          raw.timestamp,
          String(raw.date ?? ''),
        );

        return {
          id: itemDoc.id,
          scheduleId: String(raw.scheduleId ?? ''),
          studentId: String(raw.studentId ?? ''),
          studentName: String(raw.studentName ?? 'Mahasiswa'),
          nim: String(raw.nim ?? '-'),
          timestamp: timeStr,
          date: dateStr,
          status: (raw.status as 'Hadir' | 'Izin' | 'Alfa') || 'Hadir',
          rawTimestamp: (raw.timestamp as Timestamp) || null,
        };
      });

      // Urutkan berdasarkan waktu kehadiran terbaru
      records.sort((a, b) => {
        const timeA = a.rawTimestamp?.toMillis?.() ?? 0;
        const timeB = b.rawTimestamp?.toMillis?.() ?? 0;
        return timeB - timeA;
      });

      onData(records);
    },
    error => {
      onError(error.message || 'Gagal memuat rekap presensi dari Firestore.');
    },
  );
}

/**
 * Berlangganan status presensi satu praktikan pada satu sesi tertentu.
 */
export function subscribeToStudentAttendanceForSchedule(
  scheduleId: string,
  studentId: string,
  onData: (attendance: AttendanceRecordItem | null) => void,
  onError: (message: string) => void,
): () => void {
  if (!scheduleId?.trim() || !studentId?.trim()) {
    onData(null);
    return () => undefined;
  }

  const attendanceDocId = `${scheduleId}_${studentId}`;
  const attendanceDocRef = doc(db, ATTENDANCES_COLLECTION, attendanceDocId);

  return onSnapshot(
    attendanceDocRef,
    snapshot => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }

      const raw = snapshot.data() as Record<string, unknown>;
      const { timeStr, dateStr } = parseFirestoreTimestampToString(
        raw.timestamp,
        String(raw.date ?? ''),
      );

      onData({
        id: snapshot.id,
        scheduleId: String(raw.scheduleId ?? ''),
        studentId: String(raw.studentId ?? ''),
        studentName: String(raw.studentName ?? ''),
        nim: String(raw.nim ?? '-'),
        timestamp: timeStr,
        date: dateStr,
        status: (raw.status as 'Hadir' | 'Izin' | 'Alfa') || 'Hadir',
        rawTimestamp: (raw.timestamp as Timestamp) || null,
      });
    },
    error => {
      onError(error.message || 'Gagal memeriksa status presensi mahasiswa.');
    },
  );
}

/**
 * Berlangganan riwayat kehadiran praktikan secara real-time.
 * Filter query: where('studentId', '==', studentUid).
 */
export function subscribeToStudentHistory(
  studentUid: string,
  onData: (records: AttendanceRecordItem[]) => void,
  onError: (message: string) => void,
): () => void {
  if (!studentUid?.trim()) {
    onData([]);
    onError('UID praktikan tidak tersedia. Silakan login kembali.');
    return () => undefined;
  }

  const historyQuery = query(
    collection(db, ATTENDANCES_COLLECTION),
    where('studentId', '==', studentUid),
  );

  return onSnapshot(
    historyQuery,
    snapshot => {
      const records: AttendanceRecordItem[] = snapshot.docs.map(itemDoc => {
        const raw = itemDoc.data() as Record<string, unknown>;
        const { timeStr, dateStr } = parseFirestoreTimestampToString(
          raw.timestamp,
          String(raw.date ?? ''),
        );

        return {
          id: itemDoc.id,
          scheduleId: String(raw.scheduleId ?? ''),
          studentId: String(raw.studentId ?? ''),
          studentName: String(raw.studentName ?? ''),
          nim: String(raw.nim ?? '-'),
          timestamp: timeStr,
          date: dateStr,
          status: (raw.status as 'Hadir' | 'Izin' | 'Alfa') || 'Hadir',
          rawTimestamp: (raw.timestamp as Timestamp) || null,
        };
      });

      // Urutkan dari yang terbaru ke terlama
      records.sort((a, b) => {
        const timeA = a.rawTimestamp?.toMillis?.() ?? 0;
        const timeB = b.rawTimestamp?.toMillis?.() ?? 0;
        return timeB - timeA;
      });

      onData(records);
    },
    error => {
      onError(error.message || 'Gagal memuat riwayat presensi praktikan.');
    },
  );
}

/**
 * Menghitung metrik kehadiran sesi berdasarkan data Firestore aktual.
 * Menghindari fallback angka dummy (misal 20) — jika 0, tetap 0.
 * Membedakan status 'Hadir' dan 'Izin' (mendukung kontrak tugas Fritz).
 */
export function calculateAttendanceStats(
  totalRegistered: number,
  attendances: AttendanceRecordItem[],
): AttendanceStats {
  const registered = Math.max(0, totalRegistered || 0);
  const hadirCount = attendances.filter(a => a.status === 'Hadir').length;
  const izinCount = attendances.filter(a => a.status === 'Izin').length;
  const alfaCount = Math.max(0, registered - hadirCount - izinCount);
  const attendancePercentage =
    registered > 0 ? Math.round((hadirCount / registered) * 100) : 0;

  return {
    totalRegistered: registered,
    hadirCount,
    izinCount,
    alfaCount,
    attendancePercentage,
  };
}
