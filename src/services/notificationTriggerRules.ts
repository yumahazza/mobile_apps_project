/**
 * Fritz — Notification Trigger & Targeting Rules (Sprint 3)
 *
 * Logika murni untuk mengevaluasi peristiwa Firestore yang memicu push notification:
 * 1. Pembukaan sesi praktikum (status -> DIBUKA)
 * 2. Perubahan jadwal praktikum (mata praktikum, kelas, ruangan, lab, tanggal, waktu, peserta)
 * 3. Keputusan pengajuan izin (MENUNGGU -> DITERIMA | DITOLAK)
 *
 * Serta validasi penerima agar notifikasi tidak terkirim / ditampilkan kepada pengguna
 * yang tidak berkepentingan.
 */

import type { UserRole } from '@/data/users';
import type {
  NotificationNavigationTarget,
  NotificationType,
  PushNotificationPayload,
} from '@/types/notification';

export const VALID_NOTIFICATION_TYPES: readonly NotificationType[] = [
  'SESSION_OPENED',
  'SCHEDULE_UPDATED',
  'LEAVE_APPROVED',
  'LEAVE_REJECTED',
] as const;

export interface ScheduleSnapshotData {
  courseName?: string;
  className?: string;
  room?: string;
  laboratoryId?: string | null;
  date?: string;
  time?: string;
  status?: string;
  assistantId?: string;
  enrolledStudents?: unknown;
}

export interface LeaveRequestSnapshotData {
  scheduleId?: string;
  courseName?: string;
  className?: string;
  studentId?: string;
  studentName?: string;
  status?: string;
  reviewedBy?: string | null;
}

export interface NotificationTriggerDispatch {
  type: NotificationType;
  title: string;
  body: string;
  relatedId: string;
  scheduleId: string;
  recipients: string[];
  changedFields?: string[];
}

export function isValidNotificationType(value: unknown): value is NotificationType {
  return (
    typeof value === 'string' &&
    (VALID_NOTIFICATION_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Membersihkan daftar UID penerima: hanya string non-kosong, unik, dan mengecualikan UID tertentu (mis. asisten).
 */
export function dedupeRecipientUids(
  rawUids: unknown,
  excludeUid?: string | null,
): string[] {
  if (!Array.isArray(rawUids)) {
    return [];
  }

  const excluded = typeof excludeUid === 'string' ? excludeUid.trim() : '';
  const unique = new Set<string>();

  for (const item of rawUids) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (excluded && trimmed === excluded) continue;
    unique.add(trimmed);
  }

  return Array.from(unique);
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function areStringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, idx) => value === sortedB[idx]);
}

/**
 * Pemicu 1: Notifikasi Pembukaan Sesi Praktikum
 * Terpicu saat status sesi berubah menjadi 'DIBUKA' (dari status selain 'DIBUKA').
 * Penerima: hanya Praktikan yang terdaftar pada `enrolledStudents`.
 */
export function evaluateSessionOpenedTrigger(
  before: ScheduleSnapshotData | null | undefined,
  after: ScheduleSnapshotData | null | undefined,
  scheduleId: string,
): NotificationTriggerDispatch | null {
  if (!after || !scheduleId.trim()) {
    return null;
  }

  const prevStatus = normalizeText(before?.status);
  const nextStatus = normalizeText(after.status);

  if (nextStatus !== 'DIBUKA' || prevStatus === 'DIBUKA') {
    return null;
  }

  const recipients = dedupeRecipientUids(after.enrolledStudents, after.assistantId);
  if (recipients.length === 0) {
    return null;
  }

  const courseName = normalizeText(after.courseName) || 'Praktikum';
  const className = normalizeText(after.className);
  const room = normalizeText(after.room);
  const classSuffix = className ? ` (${className})` : '';
  const roomSuffix = room ? ` di ${room}` : '';

  return {
    type: 'SESSION_OPENED',
    title: `Sesi Presensi Dibuka: ${courseName}`,
    body: `Sesi ${courseName}${classSuffix}${roomSuffix} telah dibuka. Segera lakukan presensi.`,
    relatedId: scheduleId,
    scheduleId,
    recipients,
  };
}

const SCHEDULE_DETAIL_FIELDS: {
  key: keyof Pick<
    ScheduleSnapshotData,
    'courseName' | 'className' | 'room' | 'laboratoryId' | 'date' | 'time'
  >;
  label: string;
}[] = [
  { key: 'courseName', label: 'mata praktikum' },
  { key: 'className', label: 'kelas' },
  { key: 'room', label: 'ruangan' },
  { key: 'laboratoryId', label: 'laboratorium' },
  { key: 'date', label: 'tanggal' },
  { key: 'time', label: 'waktu' },
];

/**
 * Pemicu 2: Notifikasi Perubahan Jadwal Praktikum
 * Terpicu saat data jadwal (nama praktikum, kelas, ruangan/lab, tanggal, waktu, atau daftar peserta) berubah.
 * Tidak terpicu untuk perubahan status sesi saja (BELUM_DIBUKA -> DIBUKA / DIBUKA -> SELESAI).
 * Penerima: Praktikan terdampak yang terdaftar pada jadwal tersebut.
 */
export function evaluateScheduleUpdatedTrigger(
  before: ScheduleSnapshotData | null | undefined,
  after: ScheduleSnapshotData | null | undefined,
  scheduleId: string,
): NotificationTriggerDispatch | null {
  if (!before || !after || !scheduleId.trim()) {
    return null;
  }

  const changedFields: string[] = [];
  const changedLabels: string[] = [];

  for (const field of SCHEDULE_DETAIL_FIELDS) {
    const prevVal = normalizeText(before[field.key]);
    const nextVal = normalizeText(after[field.key]);
    if (prevVal !== nextVal) {
      changedFields.push(field.key);
      changedLabels.push(field.label);
    }
  }

  const prevEnrolled = dedupeRecipientUids(before.enrolledStudents, before.assistantId);
  const nextEnrolled = dedupeRecipientUids(after.enrolledStudents, after.assistantId);
  const enrolledChanged = !areStringArraysEqual(prevEnrolled, nextEnrolled);

  if (enrolledChanged) {
    changedFields.push('enrolledStudents');
  }

  if (changedFields.length === 0) {
    return null;
  }

  // Jika hanya daftar peserta yang berubah, kirim ke praktikan yang baru ditambahkan.
  // Jika detail jadwal (tanggal/waktu/ruangan/dll.) berubah, kirim ke seluruh praktikan terdaftar.
  const onlyEnrolledChanged =
    enrolledChanged && changedFields.length === 1;
  const recipients = onlyEnrolledChanged
    ? nextEnrolled.filter((uid) => !prevEnrolled.includes(uid))
    : nextEnrolled;

  if (recipients.length === 0) {
    return null;
  }

  const courseName = normalizeText(after.courseName) || 'Praktikum';
  const className = normalizeText(after.className);
  const date = normalizeText(after.date);
  const time = normalizeText(after.time);
  const room = normalizeText(after.room);
  const classSuffix = className ? ` (${className})` : '';

  const scheduleSummaryParts = [date, time, room].filter(Boolean);
  const scheduleSummary =
    scheduleSummaryParts.length > 0 ? ` (${scheduleSummaryParts.join(' · ')})` : '';

  const body = onlyEnrolledChanged
    ? `Anda terdaftar pada jadwal ${courseName}${classSuffix}${scheduleSummary}.`
    : `Perubahan ${changedLabels.join(', ')} pada ${courseName}${classSuffix}${scheduleSummary}.`;

  return {
    type: 'SCHEDULE_UPDATED',
    title: `Perubahan Jadwal: ${courseName}`,
    body,
    relatedId: scheduleId,
    scheduleId,
    recipients,
    changedFields,
  };
}

/**
 * Pemicu 3: Notifikasi Keputusan Pengajuan Izin
 * Terpicu saat status pengajuan izin berubah dari 'MENUNGGU' menjadi 'DITERIMA' atau 'DITOLAK'.
 * Penerima: HANYA Praktikan pemilik pengajuan (`studentId`).
 */
export function evaluateLeaveDecisionTrigger(
  before: LeaveRequestSnapshotData | null | undefined,
  after: LeaveRequestSnapshotData | null | undefined,
  leaveId: string,
): NotificationTriggerDispatch | null {
  if (!before || !after || !leaveId.trim()) {
    return null;
  }

  const prevStatus = normalizeText(before.status);
  const nextStatus = normalizeText(after.status);

  if (prevStatus !== 'MENUNGGU') {
    return null;
  }

  if (nextStatus !== 'DITERIMA' && nextStatus !== 'DITOLAK') {
    return null;
  }

  const studentId = normalizeText(after.studentId);
  if (!studentId) {
    return null;
  }

  const scheduleId = normalizeText(after.scheduleId) || leaveId;
  const courseName = normalizeText(after.courseName) || 'Praktikum';
  const className = normalizeText(after.className);
  const classSuffix = className ? ` (${className})` : '';
  const isApproved = nextStatus === 'DITERIMA';

  return {
    type: isApproved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
    title: isApproved ? 'Pengajuan Izin Diterima' : 'Pengajuan Izin Ditolak',
    body: isApproved
      ? `Pengajuan izin Anda untuk ${courseName}${classSuffix} telah DITERIMA oleh asisten.`
      : `Pengajuan izin Anda untuk ${courseName}${classSuffix} DITOLAK oleh asisten.`,
    relatedId: scheduleId,
    scheduleId,
    recipients: [studentId],
  };
}

/**
 * Memverifikasi apakah payload push notification ditujukan untuk pengguna yang sedang aktif.
 * Mencegah notifikasi milik akun lain (pada perangkat yang sama) tampil ke pengguna yang tidak berhak.
 */
export function isNotificationForUser(
  payload: Pick<PushNotificationPayload, 'recipientUid'>,
  activeUid: string | null | undefined,
): boolean {
  const normalizedActive = normalizeText(activeUid);
  if (!normalizedActive) {
    return false;
  }

  const targetUid = normalizeText(payload.recipientUid);
  if (!targetUid) {
    // Jika payload FCM manual (mis. dari Firebase Console test) tidak menyertakan recipientUid,
    // izinkan tampil selama pengguna sedang login.
    return true;
  }

  return targetUid === normalizedActive;
}

/**
 * Menentukan halaman tujuan ketika pengguna mengetuk notifikasi.
 */
export function resolveNotificationNavigation(
  payload: Pick<PushNotificationPayload, 'type' | 'relatedId' | 'scheduleId'>,
  activeRole: UserRole,
): NotificationNavigationTarget {
  const targetScheduleId = normalizeText(payload.scheduleId) || normalizeText(payload.relatedId);

  if (
    (payload.type === 'LEAVE_APPROVED' || payload.type === 'LEAVE_REJECTED') &&
    activeRole === 'student' &&
    targetScheduleId
  ) {
    return {
      screen: 'LeaveRequest',
      params: { scheduleId: targetScheduleId },
    };
  }

  if (
    (payload.type === 'SESSION_OPENED' || payload.type === 'SCHEDULE_UPDATED') &&
    targetScheduleId
  ) {
    return {
      screen: 'SessionDetail',
      params: { scheduleId: targetScheduleId },
    };
  }

  return { screen: 'Notifications' };
}
