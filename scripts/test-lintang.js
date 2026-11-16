/**
 * Script pengujian logika bisnis mandiri untuk modul Lintang Sprint 2
 */
const { createSentimentClassifier } = require('../ai/sentiment.js');
const model = require('../ai/model-edom.json');

function formatIndonesianDate(d = new Date()) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatIndonesianTime(d = new Date()) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss} WIB`;
}

function isDummyStudentId(id) {
  if (!id) return true;
  return /^(stu-\d+|ast-\d+|demo-|dummy-)/i.test(id.trim());
}

function calculateAttendanceStats(totalRegistered, attendances) {
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

function normalizeSentimentLabel(rawLabel) {
  if (!rawLabel) return 'Tidak Terklasifikasi';
  const clean = String(rawLabel).toLowerCase().trim();
  if (clean === 'positif' || clean === 'positive') return 'Positif';
  if (clean === 'negatif' || clean === 'negative') return 'Negatif';
  if (clean === 'netral' || clean === 'neutral') return 'Netral';
  return 'Tidak Terklasifikasi';
}

function main() {
  console.log('=== PENGUJIAN LOGIKA FITUR LINTANG (SPRINT 2) ===\n');
  let passed = 0;
  let failed = 0;

  function run(name, fn) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  run('Format Tanggal Indonesia', () => {
    const fixedDate = new Date(2026, 9, 22);
    const str = formatIndonesianDate(fixedDate);
    if (str !== '22 Okt 2026') throw new Error(`Expected '22 Okt 2026', got '${str}'`);
  });

  run('Format Waktu Indonesia menggunakan WIB', () => {
    const str = formatIndonesianTime();
    if (!str.includes('WIB')) throw new Error(`Expected to contain WIB: ${str}`);
  });

  run('Deteksi Dummy ID', () => {
    if (!isDummyStudentId('stu-1')) throw new Error('stu-1 must be detected as dummy');
    if (!isDummyStudentId('stu-2')) throw new Error('stu-2 must be detected as dummy');
    if (!isDummyStudentId('ast-1')) throw new Error('ast-1 must be detected as dummy');
    if (!isDummyStudentId('demo-user')) throw new Error('demo-user must be detected as dummy');
    if (isDummyStudentId('v8K3jLq91Za02P108BxqLa9101')) throw new Error('Real Firebase UID must NOT be dummy');
  });

  run('Pencegahan fallback palsu 20 pada rekap kehadiran', () => {
    const stats0 = calculateAttendanceStats(0, []);
    if (stats0.totalRegistered !== 0) throw new Error('totalRegistered must be 0, not fallback 20');
    if (stats0.hadirCount !== 0) throw new Error('hadirCount must be 0');
    if (stats0.alfaCount !== 0) throw new Error('alfaCount must be 0');
    if (stats0.attendancePercentage !== 0) throw new Error('attendancePercentage must be 0');
  });

  run('Perhitungan statistik kehadiran memisahkan Hadir dan Izin (Fritz compatibility)', () => {
    const mockAttendances = [
      { id: '1', status: 'Hadir' },
      { id: '2', status: 'Hadir' },
      { id: '3', status: 'Hadir' },
      { id: '4', status: 'Izin' },
    ];
    const stats = calculateAttendanceStats(10, mockAttendances);
    if (stats.totalRegistered !== 10) throw new Error('Expected 10 totalRegistered');
    if (stats.hadirCount !== 3) throw new Error(`Expected 3 Hadir, got ${stats.hadirCount}`);
    if (stats.izinCount !== 1) throw new Error(`Expected 1 Izin, got ${stats.izinCount}`);
    if (stats.alfaCount !== 6) throw new Error(`Expected 6 Alfa, got ${stats.alfaCount}`);
    if (stats.attendancePercentage !== 30) throw new Error(`Expected 30%, got ${stats.attendancePercentage}`);
  });

  run('Normalisasi label sentimen AI', () => {
    if (normalizeSentimentLabel('positif') !== 'Positif') throw new Error('Failed "positif"');
    if (normalizeSentimentLabel('positive') !== 'Positif') throw new Error('Failed "positive"');
    if (normalizeSentimentLabel('negatif') !== 'Negatif') throw new Error('Failed "negatif"');
    if (normalizeSentimentLabel('negative') !== 'Negatif') throw new Error('Failed "negative"');
    if (normalizeSentimentLabel('netral') !== 'Netral') throw new Error('Failed "netral"');
    if (normalizeSentimentLabel('neutral') !== 'Netral') throw new Error('Failed "neutral"');
    if (normalizeSentimentLabel(null) !== 'Tidak Terklasifikasi') throw new Error('Failed null fallback');
    if (normalizeSentimentLabel('') !== 'Tidak Terklasifikasi') throw new Error('Failed empty fallback');
    if (normalizeSentimentLabel('unknown_label') !== 'Tidak Terklasifikasi') throw new Error('Failed unknown fallback');
  });

  run('Inference model lokal EDOM baseline', () => {
    const classifier = createSentimentClassifier(model);
    const resPositif = classifier('penyampaian materi sangat bagus dan jelas sekali');
    if (!resPositif.label) throw new Error('Local classifier returned null label');
    const norm = normalizeSentimentLabel(resPositif.label);
    if (!['Positif', 'Negatif', 'Netral'].includes(norm)) {
      throw new Error(`Unexpected normalized label: ${norm}`);
    }
    console.log(`       Hasil klasifikasi teks positif: raw='${resPositif.label}', normalized='${norm}'`);

    const resNegatif = classifier('dosen sering terlambat dan materi sulit dipahami');
    const normNeg = normalizeSentimentLabel(resNegatif.label);
    console.log(`       Hasil klasifikasi teks negatif: raw='${resNegatif.label}', normalized='${normNeg}'`);
  });

  console.log(`\n========================================`);
  console.log(`TOTAL PENGUJIAN: ${passed + failed}`);
  console.log(`HASIL: ${passed} PASS, ${failed} FAIL`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
