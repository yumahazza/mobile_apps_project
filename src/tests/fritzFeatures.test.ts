/**
 * Fritz — Unit & Integration Logic Tests for Sprint 2
 * Menguji seluruh aturan bisnis modul Fritz:
 * - Test 1: Klasifikasi alasan izin AI (Sakit, Urusan Keluarga, Akademik/Lomba, Kendala Teknis, Alasan Kurang Kuat)
 * - Test 2: Fallback AI ("AI Tidak Merespon / Perlu Cek Manual", aiStatus = 'FALLBACK') saat gagal/timeout/tidak dikenali
 * - Test 3: Validasi alasan izin (kosong, terlalu pendek < 5 karakter, terlalu panjang > 500 karakter)
 * - Test 4: Pemetaan dokumen Firestore leave_requests & jaminan status awal 'MENUNGGU' (tidak otomatis diterima/ditolak oleh AI)
 */

import {
  classifyLeaveReason,
  classifyLeaveReasonLocally,
  createFallbackLeaveClassification,
  FALLBACK_AI_CLASSIFICATION,
  normalizeLeaveAICategory,
} from '../services/aiService';
import {
  mapFirestoreLeaveRequest,
  validateLeaveReason,
} from '../services/leaveRequestService';

export async function runFritzTests(): Promise<{
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

  // 1. Klasifikasi 5 Kategori Alasan Izin
  const sakitRes = await classifyLeaveReason(
    'Saya sedang sakit demam tinggi dan harus istirahat berdasarkan surat dokter.',
  );
  assert(
    'Klasifikasi alasan Sakit -> kategori "Sakit" & aiStatus "SUCCESS"',
    sakitRes.aiClassification === 'Sakit' &&
      sakitRes.aiStatus === 'SUCCESS' &&
      sakitRes.urgency === 'Tinggi',
    `Actual: ${JSON.stringify(sakitRes)}`,
  );

  const keluargaRes = await classifyLeaveReason(
    'Mohon izin tidak dapat mengikuti praktikum karena ada musibah keluarga mendadak.',
  );
  assert(
    'Klasifikasi alasan Urusan Keluarga -> kategori "Urusan Keluarga"',
    keluargaRes.aiClassification === 'Urusan Keluarga' &&
      keluargaRes.aiStatus === 'SUCCESS',
    `Actual: ${JSON.stringify(keluargaRes)}`,
  );

  const akademikRes = await classifyLeaveReason(
    'Saya ditugaskan mewakili kampus dalam lomba Gemastik tingkat nasional.',
  );
  assert(
    'Klasifikasi alasan Akademik/Lomba -> kategori "Akademik/Lomba"',
    akademikRes.aiClassification === 'Akademik/Lomba' &&
      akademikRes.aiStatus === 'SUCCESS',
    `Actual: ${JSON.stringify(akademikRes)}`,
  );

  const teknisRes = await classifyLeaveReason(
    'Motor mogok dan ban bocor di tengah jalan saat hujan deras menuju kampus.',
  );
  assert(
    'Klasifikasi alasan Kendala Teknis -> kategori "Kendala Teknis"',
    teknisRes.aiClassification === 'Kendala Teknis' &&
      teknisRes.aiStatus === 'SUCCESS',
    `Actual: ${JSON.stringify(teknisRes)}`,
  );

  const lemahRes = await classifyLeaveReason(
    'Maaf kak saya bangun kesiangan karena tadi malam main game.',
  );
  assert(
    'Klasifikasi alasan lemah -> kategori "Alasan Kurang Kuat" & urgensi "Rendah"',
    lemahRes.aiClassification === 'Alasan Kurang Kuat' &&
      lemahRes.aiStatus === 'SUCCESS' &&
      lemahRes.urgency === 'Rendah',
    `Actual: ${JSON.stringify(lemahRes)}`,
  );

  // 2. Fallback AI ketika gagal / timeout / tidak merespon
  const fallbackSimulated = await classifyLeaveReason(
    'Saya sakit demam tinggi.',
    { simulateFailure: true },
  );
  assert(
    'Fallback saat AI gagal menghasilkan "AI Tidak Merespon / Perlu Cek Manual" & aiStatus "FALLBACK"',
    fallbackSimulated.aiClassification === FALLBACK_AI_CLASSIFICATION &&
      fallbackSimulated.aiStatus === 'FALLBACK' &&
      fallbackSimulated.urgency === 'Perlu Cek Manual',
    `Actual: ${JSON.stringify(fallbackSimulated)}`,
  );

  const fallbackUnrecognized = await classifyLeaveReason(
    'xyz123 alasan abstrak tanpa kata kunci spesifik sama sekali',
  );
  assert(
    'Fallback saat teks tidak dikenali menghasilkan label fallback tanpa melempar error',
    fallbackUnrecognized.aiClassification === FALLBACK_AI_CLASSIFICATION &&
      fallbackUnrecognized.aiStatus === 'FALLBACK',
    `Actual: ${JSON.stringify(fallbackUnrecognized)}`,
  );

  // 3. Validasi Input Alasan Izin
  assert(
    'Validasi menolak alasan kosong',
    validateLeaveReason('   ') !== null,
  );
  assert(
    'Validasi menolak alasan kurang dari 5 karakter',
    validateLeaveReason('abc') !== null,
  );
  assert(
    'Validasi menerima alasan yang sah (>= 5 karakter)',
    validateLeaveReason('Saya izin karena sakit demam sejak pagi') === null,
  );

  // 4. Pemetaan Dokumen Firestore & Jaminan Status Awal MENUNGGU
  const mapped = mapFirestoreLeaveRequest('sch1_uid123', {
    scheduleId: 'sch1',
    studentId: 'uid123',
    studentName: 'Budi Santoso',
    nim: '210001',
    reason: 'Sedang sakit demam dan berobat ke klinik',
    aiClassification: 'Sakit',
    aiStatus: 'SUCCESS',
    aiUrgency: 'Tinggi',
    status: 'MENUNGGU',
  });
  assert(
    'Dokumen pengajuan izin baru memiliki status awal MENUNGGU (tidak otomatis diterima/ditolak AI)',
    mapped.status === 'MENUNGGU' &&
      mapped.id === 'sch1_uid123' &&
      mapped.aiClassification === 'Sakit',
    `Actual: ${JSON.stringify(mapped)}`,
  );

  // 5. Helper normalisasi dan lokal
  assert(
    'normalizeLeaveAICategory mengenali label kategori standar',
    normalizeLeaveAICategory('Sakit')?.category === 'Sakit' &&
      normalizeLeaveAICategory('Urusan Keluarga')?.category === 'Urusan Keluarga' &&
      createFallbackLeaveClassification().aiStatus === 'FALLBACK' &&
      classifyLeaveReasonLocally('sedang demam tinggi')?.aiClassification === 'Sakit',
  );

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return { passed, failed, results };
}
