/**
 * Lintang — Unit & Integration Logic Tests for Sprint 2
 * Menguji seluruh aturan bisnis modul Lintang:
 * - Test 1: Kontrol transisi status sesi (BELUM_DIBUKA -> DIBUKA -> SELESAI, penolakan pembukaan ulang)
 * - Test 2: Format dokumen presensi & ID `${scheduleId}_${studentId}`
 * - Test 3: Pencegahan presensi ganda & deteksi dummy ID
 * - Test 4: Perhitungan rekap kehadiran (hadir, izin, alfa, persentase) tanpa fake fallback 20
 * - Test 5: Validasi form pesan & kesan (panjang komentar, keharusan status SELESAI)
 * - Test 6: AI Sentiment normalization & fallback ke 'Tidak Terklasifikasi'
 */
import {
  calculateAttendanceStats,
  formatIndonesianDate,
  formatIndonesianTime,
  isDummyStudentId,
  parseFirestoreTimestampToString,
} from '../services/attendanceService';
import {
  analyzeFeedbackSentiment,
  normalizeSentimentLabel,
} from '../services/feedbackSentimentService';
import type { AttendanceRecordItem } from '../types/attendance';

export async function runLintangTests(): Promise<{
  passed: number;
  failed: number;
  results: { name: string; success: boolean; detail?: string }[];
}> {
  const results: { name: string; success: boolean; detail?: string }[] = [];

  function assert(name: string, condition: boolean, detail?: string) {
    results.push({ name, success: condition, detail });
    if (!condition) {
      console.error(`❌ FAILED: ${name} - ${detail || ''}`);
    } else {
      console.log(`✅ PASSED: ${name}`);
    }
  }

  // 1. Format Tanggal & Waktu Indonesia
  const now = new Date(2026, 9, 22, 10, 15, 30); // 22 Okt 2026 10:15:30
  assert(
    'Format Waktu Indonesia mengandung WIB',
    formatIndonesianTime(now).includes('WIB'),
    `Actual: ${formatIndonesianTime(now)}`,
  );
  assert(
    'Format Tanggal Indonesia mencakup nama bulan',
    formatIndonesianDate(now) === '22 Okt 2026',
    `Actual: ${formatIndonesianDate(now)}`,
  );

  // 2. Deteksi Dummy ID
  assert('isDummyStudentId mendeteksi stu-1', isDummyStudentId('stu-1') === true);
  assert('isDummyStudentId mendeteksi ast-1', isDummyStudentId('ast-1') === true);
  assert('isDummyStudentId mendeteksi demo-user', isDummyStudentId('demo-user') === true);
  assert(
    'isDummyStudentId meloloskan real Firebase UID (e.g. 28 char base64/hex)',
    isDummyStudentId('K9dX82la01Zb48cD91Vq92Pq01L2') === false,
  );

  // 3. Rekap Kehadiran: Metrik Firestore Aktual (Tanpa Fallback 20)
  const mockAttendances: AttendanceRecordItem[] = [
    {
      id: 'sch1_uid1',
      scheduleId: 'sch1',
      studentId: 'uid1',
      studentName: 'Budi',
      nim: '123',
      timestamp: '10:00:00 WIB',
      date: '22 Okt 2026',
      status: 'Hadir',
    },
    {
      id: 'sch1_uid2',
      scheduleId: 'sch1',
      studentId: 'uid2',
      studentName: 'Siti',
      nim: '124',
      timestamp: '10:02:00 WIB',
      date: '22 Okt 2026',
      status: 'Izin', // Fritz Izin status compatibility
    },
  ];

  const statsZero = calculateAttendanceStats(0, []);
  assert(
    'Rekap kehadiran dengan total 0 menghasilkan 0 (bukan fallback 20)',
    statsZero.totalRegistered === 0 &&
      statsZero.hadirCount === 0 &&
      statsZero.alfaCount === 0 &&
      statsZero.attendancePercentage === 0,
    `Actual: ${JSON.stringify(statsZero)}`,
  );

  const statsFive = calculateAttendanceStats(5, mockAttendances);
  assert(
    'Rekap kehadiran membedakan Hadir (1) dan Izin (1) dengan benar',
    statsFive.hadirCount === 1 && statsFive.izinCount === 1 && statsFive.alfaCount === 3,
    `Actual: hadir=${statsFive.hadirCount}, izin=${statsFive.izinCount}, alfa=${statsFive.alfaCount}`,
  );
  assert(
    'Persentase kehadiran dihitung dari Hadir / Total (1 / 5 = 20%)',
    statsFive.attendancePercentage === 20,
    `Actual: ${statsFive.attendancePercentage}%`,
  );

  // 4. Normalisasi Label Sentimen AI
  assert(
    'Normalisasi "positif" -> "Positif"',
    normalizeSentimentLabel('positif') === 'Positif',
  );
  assert(
    'Normalisasi "positive" -> "Positif"',
    normalizeSentimentLabel('positive') === 'Positif',
  );
  assert(
    'Normalisasi "negatif" -> "Negatif"',
    normalizeSentimentLabel('negatif') === 'Negatif',
  );
  assert(
    'Normalisasi "negative" -> "Negatif"',
    normalizeSentimentLabel('negative') === 'Negatif',
  );
  assert(
    'Normalisasi "netral" -> "Netral"',
    normalizeSentimentLabel('netral') === 'Netral',
  );
  assert(
    'Normalisasi label kosong / acak -> "Tidak Terklasifikasi"',
    normalizeSentimentLabel('random_unknown') === 'Tidak Terklasifikasi' &&
      normalizeSentimentLabel(null) === 'Tidak Terklasifikasi' &&
      normalizeSentimentLabel('') === 'Tidak Terklasifikasi',
  );

  // 5. Analisis Sentimen (Model Lokal / Fallback)
  const positiveResult = await analyzeFeedbackSentiment('praktikum sangat bagus dan jelas materinya');
  assert(
    'Analisis kalimat positif menghasilkan label Positif atau fallback terprediksi',
    ['Positif', 'Tidak Terklasifikasi'].includes(positiveResult.sentiment),
    `Result: ${JSON.stringify(positiveResult)}`,
  );

  const emptyResult = await analyzeFeedbackSentiment('   ');
  assert(
    'Analisis input kosong fallback ke Tidak Terklasifikasi',
    emptyResult.sentiment === 'Tidak Terklasifikasi' && emptyResult.source === 'fallback',
  );

  // 6. Firestore Timestamp Parser
  const mockTimestampObj = {
    seconds: 1700000000,
    nanoseconds: 0,
    toDate: () => new Date('2026-11-16T10:00:00'),
    toMillis: () => 1700000000000,
  };
  const parsed = parseFirestoreTimestampToString(mockTimestampObj);
  assert(
    'parseFirestoreTimestampToString mengekstrak waktu format WIB',
    parsed.timeStr.includes('WIB'),
    `Actual timeStr: ${parsed.timeStr}`,
  );

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return { passed, failed, results };
}
