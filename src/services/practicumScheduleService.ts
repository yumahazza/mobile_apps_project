/**
 * Birela — Firestore schedule and participant service.
 * Shared contract:
 * schedules/{scheduleId}
 *   courseName, className, room, date, time, status,
 *   assistantId, assistantName, enrolledStudents[], totalStudents,
 *   createdAt, updatedAt
 *
 * The authenticated Firebase UID (not a dummy/demo ID) is the identity.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import {
  getFirestoreDb,
  getSafeFirestoreDb,
} from '@/services/firebaseClient';
import type { SessionStatus } from '@/data/schedules';

const SCHEDULES_COLLECTION = 'schedules';
const USERS_COLLECTION = 'users';

export interface PracticumSchedule {
  id: string;
  courseName: string;
  className: string;
  room: string;
  laboratoryId?: string | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm - HH:mm
  status: SessionStatus;
  assistantId: string;
  assistantName: string;
  enrolledStudents: string[];
  totalStudents: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ScheduleInput {
  courseName: string;
  className: string;
  room: string;
  laboratoryId?: string | null;
  date: string;
  time: string;
  enrolledStudents: string[];
}

export interface StudentOption {
  uid: string;
  name: string;
  nim: string;
  email: string;
}

export type ScheduleRole = 'assistant' | 'student';

function mapSchedule(id: string, raw: Record<string, unknown>): PracticumSchedule {
  const rawLabId = typeof raw.laboratoryId === 'string' ? raw.laboratoryId.trim() : '';
  return {
    id,
    courseName: String(raw.courseName ?? ''),
    className: String(raw.className ?? ''),
    room: String(raw.room ?? ''),
    laboratoryId: rawLabId || null,
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
  };
}

export function validateScheduleInput(input: ScheduleInput): string | null {
  const required: Array<[string, string]> = [
    ['Nama mata praktikum', input.courseName],
    ['Nama kelas', input.className],
    ['Ruangan', input.room],
    ['Tanggal', input.date],
    ['Waktu', input.time],
  ];

  const missing = required.find(([, value]) => !value.trim());
  if (missing) return `${missing[0]} wajib diisi.`;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return 'Tanggal harus menggunakan format YYYY-MM-DD.';
  }

  const [year, month, day] = input.date.split('-').map(Number);

  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() + 1 !== month ||
    parsedDate.getUTCDate() !== day
  ) {
    return 'Tanggal tidak valid.';
  }

  const timeMatch = input.time.match(/^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/);
  if (!timeMatch) return 'Waktu harus berformat HH:mm - HH:mm.';

  const start = Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
  const end = Number(timeMatch[3]) * 60 + Number(timeMatch[4]);
  if (end <= start) return 'Waktu selesai harus lebih besar dari waktu mulai.';

  return null;
}

/**
 * Real-time subscription:
 * - assistant: schedules assigned to the authenticated assistant UID
 * - student: schedules whose enrolledStudents contains the authenticated UID
 */
export function subscribeToPracticumSchedules(
  uid: string,
  role: ScheduleRole,
  onData: (schedules: PracticumSchedule[]) => void,
  onError: (message: string) => void,
): () => void {
  if (!uid) {
    onData([]);
    onError('UID pengguna belum tersedia. Silakan login kembali.');
    return () => undefined;
  }

  const db = getSafeFirestoreDb();
  if (!db) {
    onData([]);
    onError('Cloud Firestore belum siap. Gunakan Development Build Android/iOS.');
    return () => undefined;
  }

  const base = collection(db, SCHEDULES_COLLECTION);
  const schedulesQuery =
    role === 'assistant'
      ? query(base, where('assistantId', '==', uid))
      : query(base, where('enrolledStudents', 'array-contains', uid));

  return onSnapshot(
    schedulesQuery,
    snapshot => {
      const schedules = snapshot.docs
        .map(snapshotDoc =>
          mapSchedule(snapshotDoc.id, snapshotDoc.data() as Record<string, unknown>)
        )
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
      onData(schedules);
    },
    error => onError(error.message || 'Gagal menyinkronkan jadwal dari Firestore.'),
  );
}

export async function createPracticumSchedule(
  input: ScheduleInput,
  assistant: { uid: string; name: string },
): Promise<string> {
  const validationError = validateScheduleInput(input);
  if (validationError) throw new Error(validationError);
  if (!assistant.uid) throw new Error('UID asisten tidak tersedia.');

  const db = getFirestoreDb();
  const enrolledStudents = [...new Set(input.enrolledStudents)];
  const laboratoryId = input.laboratoryId?.trim() || null;
  const created = await addDoc(collection(db, SCHEDULES_COLLECTION), {
    courseName: input.courseName.trim(),
    className: input.className.trim(),
    room: input.room.trim(),
    laboratoryId,
    date: input.date,
    time: input.time.trim(),
    status: 'BELUM_DIBUKA',
    assistantId: assistant.uid,
    assistantName: assistant.name.trim() || 'Asisten Praktikum',
    enrolledStudents,
    totalStudents: enrolledStudents.length,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return created.id;
}

export async function updatePracticumSchedule(
  scheduleId: string,
  input: ScheduleInput,
): Promise<void> {
  const validationError = validateScheduleInput(input);
  if (validationError) throw new Error(validationError);
  if (!scheduleId) throw new Error('ID jadwal tidak tersedia.');

  const db = getFirestoreDb();
  const enrolledStudents = [...new Set(input.enrolledStudents)];
  const laboratoryId = input.laboratoryId?.trim() || null;
  await updateDoc(doc(db, SCHEDULES_COLLECTION, scheduleId), {
    courseName: input.courseName.trim(),
    className: input.className.trim(),
    room: input.room.trim(),
    laboratoryId,
    date: input.date,
    time: input.time.trim(),
    enrolledStudents,
    totalStudents: enrolledStudents.length,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePracticumSchedule(scheduleId: string): Promise<void> {
  if (!scheduleId) throw new Error('ID jadwal tidak tersedia.');
  await deleteDoc(doc(getFirestoreDb(), SCHEDULES_COLLECTION, scheduleId));
}

export async function updatePracticumSessionStatus(
  scheduleId: string,
  status: SessionStatus,
): Promise<void> {
  if (!scheduleId) throw new Error('ID jadwal tidak tersedia.');
  if (status !== 'DIBUKA' && status !== 'SELESAI') {
    throw new Error('Status sesi tidak valid.');
  }
  await updateDoc(doc(getFirestoreDb(), SCHEDULES_COLLECTION, scheduleId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/** Used by the assistant participant roster and the schedule form. */
export async function getStudentDirectory(): Promise<StudentOption[]> {
  const studentsQuery = query(
    collection(getFirestoreDb(), USERS_COLLECTION),
    where('role', '==', 'student'),
  );
  const snapshot = await getDocs(studentsQuery);
  return snapshot.docs.map(item => {
    const raw = item.data() as Record<string, unknown>;
    return {
      uid: item.id,
      name: String(raw.name ?? raw.displayName ?? 'Mahasiswa'),
      nim: String(raw.nim ?? ''),
      email: String(raw.email ?? ''),
    };
  });
}

/** Replaces roster atomically from the assistant's selected UID list. */
export async function updatePracticumParticipants(
  scheduleId: string,
  studentUids: string[],
): Promise<void> {
  if (!scheduleId) throw new Error('ID jadwal tidak tersedia.');
  const enrolledStudents = [...new Set(studentUids.filter(Boolean))];
  await updateDoc(doc(getFirestoreDb(), SCHEDULES_COLLECTION, scheduleId), {
    enrolledStudents,
    totalStudents: enrolledStudents.length,
    updatedAt: serverTimestamp(),
  });
}
