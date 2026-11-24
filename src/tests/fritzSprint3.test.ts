/**
 * Fritz — Unit & Integration Tests for Sprint 3 (Push Notification, FCM & Triggers)
 *
 * Menguji seluruh aturan bisnis modul Fritz Sprint 3:
 * 1. Pemicu notifikasi pembukaan sesi (`SESSION_OPENED`) & ketepatan penerima
 * 2. Pemicu notifikasi perubahan jadwal (`SCHEDULE_UPDATED`) & penerima terdampak
 * 3. Pemicu notifikasi keputusan pengajuan izin (`LEAVE_APPROVED` / `LEAVE_REJECTED`) hanya ke pengaju
 * 4. Isolasi penerima (`isNotificationForUser`) & pemetaan navigasi ketuk notifikasi
 */

import {
  dedupeRecipientUids,
  evaluateLeaveDecisionTrigger,
  evaluateScheduleUpdatedTrigger,
  evaluateSessionOpenedTrigger,
  isNotificationForUser,
  resolveNotificationNavigation,
} from '@/services/notificationTriggerRules';

export interface FritzSprint3TestSummary {
  passed: number;
  failed: number;
  results: { name: string; success: boolean; detail?: string }[];
}

export async function runFritzSprint3Tests(): Promise<FritzSprint3TestSummary> {
  const results: { name: string; success: boolean; detail?: string }[] = [];

  function assert(name: string, condition: boolean, detail?: string) {
    results.push({ name, success: condition, detail });
    if (!condition) {
      console.error(`❌ FAILED: ${name} - ${detail || ''}`);
    } else {
      console.log(`✅ PASSED: ${name}`);
    }
  }

  // 1. Pembukaan sesi: BELUM_DIBUKA -> DIBUKA hanya kirim ke praktikan terdaftar (dedupe & exclude asisten)
  const opened = evaluateSessionOpenedTrigger(
    {
      courseName: 'Pemrograman Perangkat Bergerak',
      className: 'IF-A',
      room: 'Lab B',
      status: 'BELUM_DIBUKA',
      assistantId: 'ast-1',
      enrolledStudents: ['stu-1', 'stu-2'],
    },
    {
      courseName: 'Pemrograman Perangkat Bergerak',
      className: 'IF-A',
      room: 'Lab B',
      status: 'DIBUKA',
      assistantId: 'ast-1',
      enrolledStudents: ['stu-1', 'stu-2', 'stu-1', 'ast-1', ''],
    },
    'sch-101',
  );
  assert(
    'Pembukaan sesi memicu SESSION_OPENED hanya untuk praktikan terdaftar tanpa duplikat/asisten',
    opened !== null &&
      opened.type === 'SESSION_OPENED' &&
      opened.title.includes('Pemrograman Perangkat Bergerak') &&
      opened.recipients.length === 2 &&
      opened.recipients.includes('stu-1') &&
      opened.recipients.includes('stu-2') &&
      !opened.recipients.includes('ast-1') &&
      !opened.recipients.includes('stu-3'),
    `Actual: ${JSON.stringify(opened)}`,
  );

  // 2. Pembukaan sesi tidak terpicu ulang saat DIBUKA -> DIBUKA atau DIBUKA -> SELESAI
  const alreadyOpen = evaluateSessionOpenedTrigger(
    { status: 'DIBUKA', enrolledStudents: ['stu-1'] },
    { status: 'DIBUKA', enrolledStudents: ['stu-1'] },
    'sch-101',
  );
  const closedSession = evaluateSessionOpenedTrigger(
    { status: 'DIBUKA', enrolledStudents: ['stu-1'] },
    { status: 'SELESAI', enrolledStudents: ['stu-1'] },
    'sch-101',
  );
  assert(
    'Transisi non-pembukaan (DIBUKA->DIBUKA / DIBUKA->SELESAI) tidak memicu SESSION_OPENED',
    alreadyOpen === null && closedSession === null,
  );

  // 3. Perubahan jadwal (waktu & ruangan) memicu SCHEDULE_UPDATED ke peserta terdampak
  const scheduleChanged = evaluateScheduleUpdatedTrigger(
    {
      courseName: 'Basis Data',
      className: 'IF-B',
      room: 'Lab A',
      date: '2026-11-25',
      time: '08:00 - 10:00',
      status: 'BELUM_DIBUKA',
      assistantId: 'ast-1',
      enrolledStudents: ['stu-1', 'stu-2'],
    },
    {
      courseName: 'Basis Data',
      className: 'IF-B',
      room: 'Lab C',
      date: '2026-11-25',
      time: '10:00 - 12:00',
      status: 'BELUM_DIBUKA',
      assistantId: 'ast-1',
      enrolledStudents: ['stu-1', 'stu-2'],
    },
    'sch-202',
  );
  assert(
    'Perubahan ruangan & waktu jadwal memicu SCHEDULE_UPDATED ke praktikan terdaftar',
    scheduleChanged !== null &&
      scheduleChanged.type === 'SCHEDULE_UPDATED' &&
      scheduleChanged.recipients.length === 2 &&
      scheduleChanged.body.includes('ruangan') &&
      scheduleChanged.body.includes('waktu'),
    `Actual: ${JSON.stringify(scheduleChanged)}`,
  );

  // 4. Perubahan status sesi saja tidak memicu SCHEDULE_UPDATED
  const statusOnlyChange = evaluateScheduleUpdatedTrigger(
    {
      courseName: 'Basis Data',
      className: 'IF-B',
      room: 'Lab A',
      date: '2026-11-25',
      time: '08:00 - 10:00',
      status: 'BELUM_DIBUKA',
      assistantId: 'ast-1',
      enrolledStudents: ['stu-1'],
    },
    {
      courseName: 'Basis Data',
      className: 'IF-B',
      room: 'Lab A',
      date: '2026-11-25',
      time: '08:00 - 10:00',
      status: 'DIBUKA',
      assistantId: 'ast-1',
      enrolledStudents: ['stu-1'],
    },
    'sch-202',
  );
  assert(
    'Perubahan status sesi saja tidak memicu duplikasi SCHEDULE_UPDATED',
    statusOnlyChange === null,
  );

  // 5. Penambahan peserta baru hanya menotifikasi peserta baru jika detail jadwal lain tetap sama
  const addedStudentOnly = evaluateScheduleUpdatedTrigger(
    {
      courseName: 'Jaringan Komputer',
      className: 'IF-A',
      room: 'Lab D',
      date: '2026-11-26',
      time: '13:00 - 15:00',
      status: 'BELUM_DIBUKA',
      assistantId: 'ast-1',
      enrolledStudents: ['stu-1'],
    },
    {
      courseName: 'Jaringan Komputer',
      className: 'IF-A',
      room: 'Lab D',
      date: '2026-11-26',
      time: '13:00 - 15:00',
      status: 'BELUM_DIBUKA',
      assistantId: 'ast-1',
      enrolledStudents: ['stu-1', 'stu-3'],
    },
    'sch-303',
  );
  assert(
    'Penambahan peserta baru hanya mengirim SCHEDULE_UPDATED kepada peserta yang baru ditambahkan',
    addedStudentOnly !== null &&
      addedStudentOnly.recipients.length === 1 &&
      addedStudentOnly.recipients[0] === 'stu-3',
    `Actual: ${JSON.stringify(addedStudentOnly)}`,
  );

  // 6. Keputusan izin DITERIMA & DITOLAK hanya dikirim ke pengaju
  const approved = evaluateLeaveDecisionTrigger(
    {
      scheduleId: 'sch-101',
      courseName: 'Pemrograman Perangkat Bergerak',
      className: 'IF-A',
      studentId: 'stu-1',
      status: 'MENUNGGU',
    },
    {
      scheduleId: 'sch-101',
      courseName: 'Pemrograman Perangkat Bergerak',
      className: 'IF-A',
      studentId: 'stu-1',
      status: 'DITERIMA',
    },
    'sch-101_stu-1',
  );
  assert(
    'Keputusan izin MENUNGGU->DITERIMA memicu LEAVE_APPROVED hanya untuk studentId pengaju',
    approved !== null &&
      approved.type === 'LEAVE_APPROVED' &&
      approved.recipients.length === 1 &&
      approved.recipients[0] === 'stu-1' &&
      approved.body.includes('DITERIMA'),
    `Actual: ${JSON.stringify(approved)}`,
  );

  const rejected = evaluateLeaveDecisionTrigger(
    {
      scheduleId: 'sch-101',
      courseName: 'Pemrograman Perangkat Bergerak',
      studentId: 'stu-2',
      status: 'MENUNGGU',
    },
    {
      scheduleId: 'sch-101',
      courseName: 'Pemrograman Perangkat Bergerak',
      studentId: 'stu-2',
      status: 'DITOLAK',
    },
    'sch-101_stu-2',
  );
  assert(
    'Keputusan izin MENUNGGU->DITOLAK memicu LEAVE_REJECTED hanya untuk studentId pengaju',
    rejected !== null &&
      rejected.type === 'LEAVE_REJECTED' &&
      rejected.recipients.length === 1 &&
      rejected.recipients[0] === 'stu-2' &&
      rejected.body.includes('DITOLAK'),
    `Actual: ${JSON.stringify(rejected)}`,
  );

  // 7. Keputusan ulang izin yang sudah diproses tidak memicu notifikasi lagi
  const repeatedDecision = evaluateLeaveDecisionTrigger(
    { scheduleId: 'sch-101', studentId: 'stu-1', status: 'DITERIMA' },
    { scheduleId: 'sch-101', studentId: 'stu-1', status: 'DITERIMA' },
    'sch-101_stu-1',
  );
  assert(
    'Status izin yang sudah diputuskan tidak memicu notifikasi ulang',
    repeatedDecision === null,
  );

  // 8. Isolasi penerima di perangkat (user A tidak melihat push milik user B)
  assert(
    'isNotificationForUser menolak notifikasi milik akun lain',
    isNotificationForUser({ recipientUid: 'stu-1' }, 'stu-1') === true &&
      isNotificationForUser({ recipientUid: 'stu-1' }, 'stu-2') === false &&
      isNotificationForUser({ recipientUid: 'stu-1' }, null) === false,
  );

  // 9. Navigasi tap notifikasi
  const navSession = resolveNotificationNavigation(
    { type: 'SESSION_OPENED', relatedId: 'sch-101', scheduleId: 'sch-101' },
    'student',
  );
  const navLeave = resolveNotificationNavigation(
    { type: 'LEAVE_APPROVED', relatedId: 'sch-101', scheduleId: 'sch-101' },
    'student',
  );
  assert(
    'resolveNotificationNavigation mengarahkan ke halaman yang tepat per jenis notifikasi',
    navSession.screen === 'SessionDetail' &&
      navSession.params?.scheduleId === 'sch-101' &&
      navLeave.screen === 'LeaveRequest' &&
      navLeave.params?.scheduleId === 'sch-101',
  );

  // 10. Deduplikasi penerima membersihkan input kosong / non-string
  const cleaned = dedupeRecipientUids(['stu-1', '', '  ', null, 'stu-1', 'ast-1'], 'ast-1');
  assert(
    'dedupeRecipientUids hanya menyimpan UID valid unik non-asisten',
    cleaned.length === 1 && cleaned[0] === 'stu-1',
  );

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  return { passed, failed, results };
}
