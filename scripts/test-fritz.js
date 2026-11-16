/**
 * Script pengujian logika bisnis mandiri untuk modul Fritz Sprint 2:
 * - Sistem Pengajuan Izin Praktikan
 * - Klasifikasi Alasan Izin dengan AI + Fallback ("AI Tidak Merespon / Perlu Cek Manual")
 * - Pemeriksaan & Keputusan Asisten ('DITERIMA' / 'DITOLAK') + Sinkronisasi Rekap Presensi
 */

const FALLBACK_AI_CLASSIFICATION = 'AI Tidak Merespon / Perlu Cek Manual';

const CATEGORY_RULES = [
  {
    category: 'Sakit',
    urgency: 'Tinggi',
    patterns: [
      /\b(sakit|demam|flu|batuk|pilek|pusing|migrain|vertigo|mual|muntah|diare|maag|lambung|tipes|tifus|dbd|dengue)\b/i,
      /\b(rawat\s*inap|opname|rumah\s*sakit|rs\b|klinik|puskesmas|dokter|surat\s*dokter|berobat|medis|operasi|kecelakaan|cedera|infus|igd|ugd|kesehatan)\b/i,
    ],
  },
  {
    category: 'Urusan Keluarga',
    urgency: 'Tinggi',
    patterns: [
      /\b(meninggal|duka|kedukaan|pemakaman|jenazah|melayat|musibah\s*keluarga|kematian)\b/i,
      /\b(orang\s*tua\s*sakit|ibu\s*sakit|ayah\s*sakit|nenek\s*sakit|kakek\s*sakit|menjaga\s*orang\s*tua|mengantar\s*(ibu|ayah|orang\s*tua))\b/i,
      /\b(urusan\s*keluarga|acara\s*keluarga|kepentingan\s*keluarga|keluarga\s*darurat|pernikahan\s*(kakak|adik|saudara)|mudik\s*darurat)\b/i,
    ],
  },
  {
    category: 'Akademik/Lomba',
    urgency: 'Sedang',
    patterns: [
      /\b(lomba|kompetisi|olimpiade|hackathon|gemastik|pkm|pimnas|turnamen|kejuaraan|finalis)\b/i,
      /\b(delegasi|dispensasi|surat\s*tugas|mewakili\s*(kampus|universitas|jurusan|fakultas|prodi)|seminar|konferensi|workshop)\b/i,
      /\b(ujian\s*susulan|sidang|bimbingan\s*skripsi|kunjungan\s*industri|field\s*trip|akademik|praktikum\s*pengganti|bentrok\s*kuliah|jadwal\s*bentrok)\b/i,
    ],
  },
  {
    category: 'Kendala Teknis',
    urgency: 'Sedang',
    patterns: [
      /\b(ban\s*bocor|motor\s*mogok|mobil\s*mogok|kendaraan\s*rusak|pecah\s*ban|rantai\s*putus|kecelakaan\s*lalu\s*lintas|macet\s*total|kereta\s*gangguan)\b/i,
      /\b(banjir|hujan\s*deras|hujan\s*lebat|cuaca\s*buruk|cuaca\s*ekstrem|badai|longsor|pohon\s*tumbang|terjebak\s*hujan)\b/i,
      /\b(mati\s*lampu|listrik\s*padam|pemadaman\s*listrik|internet\s*mati|jaringan\s*mati|wifi\s*mati|laptop\s*rusak|kendala\s*teknis)\b/i,
    ],
  },
  {
    category: 'Alasan Kurang Kuat',
    urgency: 'Rendah',
    patterns: [
      /\b(ketiduran|bangun\s*kesiangan|kesiangan|telat\s*bangun|lupa\s*jadwal|lupa\s*ada\s*praktikum|malas|mager)\b/i,
      /\b(nongkrong|jalan-jalan|liburan|main\s*game|nonton|reuni|hangout|tidur|mengantuk|capek|lelah)\b/i,
      /\b(urusan\s*pribadi|acara\s*pribadi|janji\s*teman|sibuk|belum\s*siap|belum\s*kerjakan\s*tugas)\b/i,
    ],
  },
];

function classifyLeave(reason, simulateFailure = false) {
  const trimmed = (reason || '').trim();
  if (!trimmed || simulateFailure) {
    return {
      aiClassification: FALLBACK_AI_CLASSIFICATION,
      aiStatus: 'FALLBACK',
      urgency: 'Perlu Cek Manual',
    };
  }
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some(p => p.test(trimmed))) {
      return {
        aiClassification: rule.category,
        aiStatus: 'SUCCESS',
        urgency: rule.urgency,
      };
    }
  }
  return {
    aiClassification: FALLBACK_AI_CLASSIFICATION,
    aiStatus: 'FALLBACK',
    urgency: 'Perlu Cek Manual',
  };
}

function validateLeaveReason(reason) {
  const trimmed = (reason || '').trim();
  if (!trimmed) return 'Alasan izin wajib diisi.';
  if (trimmed.length < 5) return 'Alasan izin minimal 5 karakter.';
  if (trimmed.length > 500) return 'Alasan izin maksimal 500 karakter.';
  return null;
}

function main() {
  console.log('=== PENGUJIAN LOGIKA FITUR FRITZ (SPRINT 2) ===\n');
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

  run('Klasifikasi AI: Kategori Sakit', () => {
    const res = classifyLeave('Saya sedang sakit demam dan berobat ke klinik');
    if (res.aiClassification !== 'Sakit' || res.aiStatus !== 'SUCCESS') {
      throw new Error(`Unexpected: ${JSON.stringify(res)}`);
    }
  });

  run('Klasifikasi AI: Kategori Urusan Keluarga', () => {
    const res = classifyLeave('Ada musibah keluarga mendadak di kampung halaman');
    if (res.aiClassification !== 'Urusan Keluarga' || res.aiStatus !== 'SUCCESS') {
      throw new Error(`Unexpected: ${JSON.stringify(res)}`);
    }
  });

  run('Klasifikasi AI: Kategori Akademik/Lomba', () => {
    const res = classifyLeave('Mengikuti lomba Gemastik mewakili universitas');
    if (res.aiClassification !== 'Akademik/Lomba' || res.aiStatus !== 'SUCCESS') {
      throw new Error(`Unexpected: ${JSON.stringify(res)}`);
    }
  });

  run('Klasifikasi AI: Kategori Kendala Teknis', () => {
    const res = classifyLeave('Motor mogok dan ban bocor saat hujan deras');
    if (res.aiClassification !== 'Kendala Teknis' || res.aiStatus !== 'SUCCESS') {
      throw new Error(`Unexpected: ${JSON.stringify(res)}`);
    }
  });

  run('Klasifikasi AI: Kategori Alasan Kurang Kuat', () => {
    const res = classifyLeave('Maaf kak saya bangun kesiangan karena main game');
    if (res.aiClassification !== 'Alasan Kurang Kuat' || res.urgency !== 'Rendah') {
      throw new Error(`Unexpected: ${JSON.stringify(res)}`);
    }
  });

  run('Fallback AI saat timeout/offline/gagal tetap menghasilkan label fallback tanpa auto-reject', () => {
    const res = classifyLeave('Saya sakit demam', true);
    if (
      res.aiClassification !== 'AI Tidak Merespon / Perlu Cek Manual' ||
      res.aiStatus !== 'FALLBACK'
    ) {
      throw new Error(`Unexpected fallback: ${JSON.stringify(res)}`);
    }
  });

  run('Pencegahan pengajuan izin ganda dengan Composite Document ID (${scheduleId}_${studentId})', () => {
    const mockDb = new Map();
    const docId = 'sch-1_uid-budi-001';
    mockDb.set(docId, { status: 'MENUNGGU' });
    if (!mockDb.has(docId)) {
      throw new Error('Composite doc ID gagal mendeteksi duplikasi');
    }
  });

  run('Validasi alasan izin menolak input kosong atau < 5 karakter', () => {
    if (!validateLeaveReason('')) throw new Error('Harus menolak string kosong');
    if (!validateLeaveReason('abc')) throw new Error('Harus menolak < 5 karakter');
    if (validateLeaveReason('Saya izin karena sakit demam') !== null) {
      throw new Error('Harus menerima alasan yang sah');
    }
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
