/**
 * Yuma — Laboratory Service (Sprint 3)
 *
 * Mengelola koleksi Cloud Firestore `laboratories` sebagai sumber acuan
 * koordinat dan radius presensi bagi modul Presensi (Lintang) & Maps (Birela).
 *
 * Aturan akses & bisnis:
 * - Read: semua pengguna terautentikasi (Asisten & Praktikan)
 * - Create / Update / Delete: khusus role 'assistant'
 * - Delete ditolak apabila masih ada jadwal berstatus 'DIBUKA' yang memakai lab tersebut
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import {
  getFirestoreDb,
  getSafeAuthUid,
  getSafeFirestoreDb,
} from '@/services/firebaseClient';
import { parseFirestoreTimestampToString } from '@/services/attendanceService';
import type { PracticumSchedule } from '@/services/practicumScheduleService';
import type { Laboratory, LaboratoryInput } from '@/types/laboratory';
import type { UserRole } from '@/data/users';

const LABORATORIES_COLLECTION = 'laboratories';
const SCHEDULES_COLLECTION = 'schedules';
const USERS_COLLECTION = 'users';

export const MIN_LABORATORY_RADIUS_METERS = 5;
export const MAX_LABORATORY_RADIUS_METERS = 5000;
export const DEFAULT_LABORATORY_RADIUS_METERS = 50;

export interface LaboratoryCallerContext {
  uid?: string;
  role?: UserRole;
}

/**
 * Menormalkan nama laboratorium / ruangan untuk pencocokan fallback yang tahan perbedaan kapitalisasi/spasi.
 */
export function normalizeLaboratoryName(name: string): string {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Parsing input koordinat (mendukung pemisah desimal titik atau koma tunggal).
 */
export function parseCoordinateInput(raw: string | number): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }

  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(',', '.');
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parsing input radius dalam meter.
 */
export function parseRadiusInput(raw: string | number): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }

  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Memvalidasi input data laboratorium sebelum disimpan ke Firestore.
 */
export function validateLaboratoryInput(input: LaboratoryInput): string | null {
  const name = String(input.name ?? '').trim();
  const building = String(input.building ?? '').trim();
  const floorRaw = input.floor;

  if (!name) return 'Nama laboratorium wajib diisi.';
  if (name.length < 2) return 'Nama laboratorium minimal 2 karakter.';
  if (name.length > 100) return 'Nama laboratorium maksimal 100 karakter.';

  if (!building) return 'Nama gedung wajib diisi.';
  if (building.length > 100) return 'Nama gedung maksimal 100 karakter.';

  if (typeof floorRaw === 'number') {
    if (!Number.isFinite(floorRaw)) return 'Lantai tidak valid.';
  } else {
    const floorText = String(floorRaw ?? '').trim();
    if (!floorText) return 'Lantai wajib diisi.';
    if (floorText.length > 50) return 'Lantai maksimal 50 karakter.';
  }

  if (
    typeof input.latitude !== 'number' ||
    !Number.isFinite(input.latitude) ||
    input.latitude < -90 ||
    input.latitude > 90
  ) {
    return 'Latitude harus berupa angka valid antara -90 sampai 90.';
  }

  if (
    typeof input.longitude !== 'number' ||
    !Number.isFinite(input.longitude) ||
    input.longitude < -180 ||
    input.longitude > 180
  ) {
    return 'Longitude harus berupa angka valid antara -180 sampai 180.';
  }

  if (
    typeof input.radius !== 'number' ||
    !Number.isFinite(input.radius) ||
    input.radius < MIN_LABORATORY_RADIUS_METERS ||
    input.radius > MAX_LABORATORY_RADIUS_METERS
  ) {
    return `Radius presensi harus antara ${MIN_LABORATORY_RADIUS_METERS} hingga ${MAX_LABORATORY_RADIUS_METERS} meter.`;
  }

  return null;
}

/**
 * Pemetaan dokumen mentah Firestore menjadi model `Laboratory`.
 */
export function mapLaboratory(
  docId: string,
  raw: Record<string, unknown>,
): Laboratory {
  const createdParsed = parseFirestoreTimestampToString(raw.createdAt);
  const updatedParsed = parseFirestoreTimestampToString(raw.updatedAt);

  return {
    id: docId,
    name: String(raw.name ?? ''),
    building: String(raw.building ?? ''),
    floor:
      typeof raw.floor === 'number'
        ? String(raw.floor)
        : String(raw.floor ?? ''),
    latitude: Number(raw.latitude ?? 0),
    longitude: Number(raw.longitude ?? 0),
    radius: Number(raw.radius ?? DEFAULT_LABORATORY_RADIUS_METERS),
    createdAt: `${createdParsed.dateStr} • ${createdParsed.timeStr}`,
    updatedAt: `${updatedParsed.dateStr} • ${updatedParsed.timeStr}`,
    rawCreatedAt: (raw.createdAt as Laboratory['rawCreatedAt']) ?? null,
    rawUpdatedAt: (raw.updatedAt as Laboratory['rawUpdatedAt']) ?? null,
  };
}

function normalizeFloorForStorage(floor: string | number): string | number {
  if (typeof floor === 'number') {
    return floor;
  }
  return String(floor).trim();
}

async function ensureAssistantAccess(
  callerContext?: LaboratoryCallerContext,
): Promise<string> {
  const uid = getSafeAuthUid() || callerContext?.uid?.trim() || '';
  if (!uid) {
    throw new Error(
      'Autentikasi diperlukan. Silakan login sebagai asisten terlebih dahulu.',
    );
  }

  if (callerContext?.role && callerContext.role !== 'assistant') {
    throw new Error(
      'Akses ditolak: Pengelolaan data laboratorium hanya diizinkan untuk Asisten.',
    );
  }

  const db = getFirestoreDb();
  const userSnap = await getDoc(doc(db, USERS_COLLECTION, uid));
  if (userSnap.exists()) {
    const userData = userSnap.data() as Record<string, unknown>;
    if (userData?.role !== 'assistant') {
      throw new Error(
        'Akses ditolak: Pengelolaan data laboratorium hanya diizinkan untuk Asisten.',
      );
    }
  } else if (callerContext?.role !== 'assistant') {
    throw new Error(
      'Akses ditolak: Profil asisten tidak ditemukan di Firestore.',
    );
  }

  return uid;
}

/**
 * Memeriksa apakah suatu jadwal praktikum merujuk ke laboratorium tertentu.
 */
export function scheduleMatchesLaboratory(
  schedule: Pick<PracticumSchedule, 'room' | 'laboratoryId'>,
  laboratory: Pick<Laboratory, 'id' | 'name'>,
): boolean {
  if (schedule.laboratoryId && schedule.laboratoryId === laboratory.id) {
    return true;
  }
  const normalizedRoom = normalizeLaboratoryName(schedule.room);
  const normalizedLab = normalizeLaboratoryName(laboratory.name);
  return Boolean(normalizedRoom) && normalizedRoom === normalizedLab;
}

/**
 * Mencari daftar jadwal yang merujuk ke laboratorium tertentu (untuk validasi & peringatan modal hapus).
 */
export function findSchedulesReferencingLaboratory(
  laboratory: Pick<Laboratory, 'id' | 'name'>,
  schedules: Pick<PracticumSchedule, 'id' | 'courseName' | 'className' | 'room' | 'laboratoryId' | 'status'>[],
): {
  openSchedules: Pick<PracticumSchedule, 'id' | 'courseName' | 'className' | 'room' | 'laboratoryId' | 'status'>[];
  otherSchedules: Pick<PracticumSchedule, 'id' | 'courseName' | 'className' | 'room' | 'laboratoryId' | 'status'>[];
} {
  const matched = schedules.filter((schedule) =>
    scheduleMatchesLaboratory(schedule, laboratory),
  );
  return {
    openSchedules: matched.filter((schedule) => schedule.status === 'DIBUKA'),
    otherSchedules: matched.filter((schedule) => schedule.status !== 'DIBUKA'),
  };
}

/**
 * Menentukan laboratorium yang sesuai untuk sebuah jadwal:
 * 1. Prioritaskan kecocokan eksplisit `schedule.laboratoryId === lab.id`
 * 2. Fallback ke pencocokan nama ruangan `schedule.room` (case-insensitive)
 */
export function resolveLaboratoryForSchedule(
  schedule: Pick<PracticumSchedule, 'room' | 'laboratoryId'>,
  laboratories: Laboratory[],
): Laboratory | undefined {
  if (schedule.laboratoryId) {
    const byId = laboratories.find((lab) => lab.id === schedule.laboratoryId);
    if (byId) return byId;
  }

  const normalizedRoom = normalizeLaboratoryName(schedule.room);
  if (!normalizedRoom) return undefined;

  return laboratories.find(
    (lab) => normalizeLaboratoryName(lab.name) === normalizedRoom,
  );
}

/**
 * Berlangganan daftar laboratorium dari Cloud Firestore secara real-time.
 */
export function subscribeToLaboratories(
  onData: (laboratories: Laboratory[]) => void,
  onError: (message: string) => void,
): () => void {
  const db = getSafeFirestoreDb();
  if (!db) {
    onData([]);
    onError('Cloud Firestore belum siap. Gunakan Development Build Android/iOS.');
    return () => undefined;
  }

  const labsRef = collection(db, LABORATORIES_COLLECTION);

  return onSnapshot(
    labsRef,
    (snapshot) => {
      const list = snapshot.docs
        .map((docSnap) =>
          mapLaboratory(docSnap.id, docSnap.data() as Record<string, unknown>),
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'id'));
      onData(list);
    },
    (error) => {
      onError(error.message || 'Gagal memuat data laboratorium dari Firestore.');
    },
  );
}

/**
 * Mengambil seluruh daftar laboratorium satu kali (untuk validasi presensi atau lookup cepat).
 */
export async function getLaboratories(): Promise<Laboratory[]> {
  const db = getFirestoreDb();
  const snapshot = await getDocs(collection(db, LABORATORIES_COLLECTION));
  return snapshot.docs
    .map((docSnap) =>
      mapLaboratory(docSnap.id, docSnap.data() as Record<string, unknown>),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

/**
 * Mengambil satu dokumen laboratorium berdasarkan ID.
 */
export async function getLaboratoryById(
  laboratoryId: string,
): Promise<Laboratory | null> {
  if (!laboratoryId?.trim()) return null;
  const db = getFirestoreDb();
  const snapshot = await getDoc(
    doc(db, LABORATORIES_COLLECTION, laboratoryId.trim()),
  );
  if (!snapshot.exists()) return null;
  return mapLaboratory(
    snapshot.id,
    snapshot.data() as Record<string, unknown>,
  );
}

/**
 * Menambahkan data laboratorium baru ke koleksi `laboratories` (khusus Asisten).
 */
export async function createLaboratory(
  input: LaboratoryInput,
  callerContext?: LaboratoryCallerContext,
): Promise<string> {
  const validationError = validateLaboratoryInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  await ensureAssistantAccess(callerContext);

  const db = getFirestoreDb();
  const newDocRef = doc(collection(db, LABORATORIES_COLLECTION));

  await setDoc(newDocRef, {
    id: newDocRef.id,
    name: input.name.trim(),
    building: input.building.trim(),
    floor: normalizeFloorForStorage(input.floor),
    latitude: input.latitude,
    longitude: input.longitude,
    radius: input.radius,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return newDocRef.id;
}

/**
 * Memperbarui data lokasi, koordinat, atau radius laboratorium (khusus Asisten).
 */
export async function updateLaboratory(
  laboratoryId: string,
  input: LaboratoryInput,
  callerContext?: LaboratoryCallerContext,
): Promise<void> {
  if (!laboratoryId?.trim()) {
    throw new Error('ID laboratorium tidak tersedia.');
  }

  const validationError = validateLaboratoryInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  await ensureAssistantAccess(callerContext);

  const db = getFirestoreDb();
  await updateDoc(doc(db, LABORATORIES_COLLECTION, laboratoryId.trim()), {
    name: input.name.trim(),
    building: input.building.trim(),
    floor: normalizeFloorForStorage(input.floor),
    latitude: input.latitude,
    longitude: input.longitude,
    radius: input.radius,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Menghapus laboratorium dari Firestore (khusus Asisten).
 * Menolak penghapusan apabila masih ada jadwal berstatus 'DIBUKA' yang memakai laboratorium tersebut.
 */
export async function deleteLaboratory(
  laboratoryId: string,
  callerContext?: LaboratoryCallerContext,
): Promise<void> {
  const cleanId = laboratoryId?.trim();
  if (!cleanId) {
    throw new Error('ID laboratorium tidak tersedia.');
  }

  const assistantUid = await ensureAssistantAccess(callerContext);
  const db = getFirestoreDb();

  const labRef = doc(db, LABORATORIES_COLLECTION, cleanId);
  const labSnap = await getDoc(labRef);
  if (!labSnap.exists()) {
    throw new Error('Data laboratorium tidak ditemukan.');
  }

  const lab = mapLaboratory(
    labSnap.id,
    labSnap.data() as Record<string, unknown>,
  );

  // Query difilter berdasarkan assistantId sesuai aturan baca koleksi `schedules` pada firestore.rules.
  const assistantSchedulesQuery = query(
    collection(db, SCHEDULES_COLLECTION),
    where('assistantId', '==', assistantUid),
  );
  const schedulesSnap = await getDocs(assistantSchedulesQuery);
  const assistantSchedules = schedulesSnap.docs.map((docSnap) => {
    const raw = docSnap.data() as Record<string, unknown>;
    return {
      id: docSnap.id,
      courseName: String(raw.courseName ?? ''),
      className: String(raw.className ?? ''),
      room: String(raw.room ?? ''),
      laboratoryId:
        typeof raw.laboratoryId === 'string' ? raw.laboratoryId : null,
      status: (raw.status as PracticumSchedule['status']) ?? 'BELUM_DIBUKA',
    };
  });

  const { openSchedules } = findSchedulesReferencingLaboratory(
    lab,
    assistantSchedules,
  );
  if (openSchedules.length > 0) {
    throw new Error(
      `Laboratorium "${lab.name}" tidak dapat dihapus karena sedang digunakan oleh sesi berstatus DIBUKA. Tutup sesi terlebih dahulu.`,
    );
  }

  await deleteDoc(labRef);
}
