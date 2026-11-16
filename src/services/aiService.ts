/**
 * Fritz — AI Service untuk Klasifikasi Alasan Izin Praktikan (Sprint 2)
 *
 * Tanggung Jawab Teknis (PRD Sprint 2 - Bagian 4.2):
 * - Menganalisis teks alasan izin praktikan dan menghasilkan kategori/klasifikasi:
 *   ('Sakit', 'Urusan Keluarga', 'Akademik/Lomba', 'Kendala Teknis', 'Alasan Kurang Kuat')
 *   beserta ringkasan tingkat urgensi.
 * - Penanganan Fallback & Aturan AI:
 *   Jika AI gagal/tidak merespon (timeout/offline/tidak dikenali), pengajuan izin tetap
 *   tersimpan di Firestore dengan label klasifikasi "AI Tidak Merespon / Perlu Cek Manual"
 *   dan aiStatus = 'FALLBACK'.
 * - Pengajuan izin TIDAK BOLEH otomatis diterima atau ditolak oleh AI — keputusan akhir
 *   100% berada di tangan Asisten (status awal selalu 'MENUNGGU').
 */

import type {
  LeaveAICategory,
  LeaveAIClassificationResult,
  LeaveUrgencyLevel,
} from '@/types/leaveRequest';

export const FALLBACK_AI_CLASSIFICATION: LeaveAICategory =
  'AI Tidak Merespon / Perlu Cek Manual';

export const FALLBACK_AI_SUMMARY =
  'AI tidak merespon atau alasan belum dapat diklasifikasikan otomatis. Asisten perlu memeriksa alasan secara manual.';

export interface ClassifyLeaveOptions {
  timeoutMs?: number;
  simulateFailure?: boolean;
  endpointUrl?: string;
  geminiApiKey?: string;
  disableLocalFallbackClassifier?: boolean;
}

interface CategoryRule {
  category: LeaveAICategory;
  urgency: LeaveUrgencyLevel;
  summary: string;
  patterns: RegExp[];
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Sakit',
    urgency: 'Tinggi',
    summary: 'Urgensi Tinggi — Indikasi kondisi kesehatan atau medis praktikan.',
    patterns: [
      /\b(sakit|demam|flu|batuk|pilek|pusing|migrain|vertigo|mual|muntah|diare|maag|lambung|tipes|tifus|dbd|dengue)\b/i,
      /\b(rawat\s*inap|opname|rumah\s*sakit|rs\b|klinik|puskesmas|dokter|surat\s*dokter|berobat|medis|operasi|kecelakaan|cedera|infus|igd|ugd|kesehatan)\b/i,
    ],
  },
  {
    category: 'Urusan Keluarga',
    urgency: 'Tinggi',
    summary: 'Urgensi Tinggi — Kepentingan keluarga mendesak atau kedukaan.',
    patterns: [
      /\b(meninggal|duka|kedukaan|pemakaman|jenazah|melayat|musibah\s*keluarga|kematian)\b/i,
      /\b(orang\s*tua\s*sakit|ibu\s*sakit|ayah\s*sakit|nenek\s*sakit|kakek\s*sakit|menjaga\s*orang\s*tua|mengantar\s*(ibu|ayah|orang\s*tua))\b/i,
      /\b(urusan\s*keluarga|acara\s*keluarga|kepentingan\s*keluarga|keluarga\s*darurat|pernikahan\s*(kakak|adik|saudara)|mudik\s*darurat)\b/i,
    ],
  },
  {
    category: 'Akademik/Lomba',
    urgency: 'Sedang',
    summary: 'Urgensi Sedang — Kegiatan akademik resmi, delegasi kampus, atau perlombaan.',
    patterns: [
      /\b(lomba|kompetisi|olimpiade|hackathon|gemastik|pkm|pimnas|turnamen|kejuaraan|finalis)\b/i,
      /\b(delegasi|dispensasi|surat\s*tugas|mewakili\s*(kampus|universitas|jurusan|fakultas|prodi)|seminar|konferensi|workshop)\b/i,
      /\b(ujian\s*susulan|sidang|bimbingan\s*skripsi|kunjungan\s*industri|field\s*trip|akademik|praktikum\s*pengganti|bentrok\s*kuliah|jadwal\s*bentrok)\b/i,
    ],
  },
  {
    category: 'Kendala Teknis',
    urgency: 'Sedang',
    summary: 'Urgensi Sedang — Kendala transportasi, cuaca ekstrem, atau fasilitas teknis.',
    patterns: [
      /\b(ban\s*bocor|motor\s*mogok|mobil\s*mogok|kendaraan\s*rusak|pecah\s*ban|rantai\s*putus|kecelakaan\s*lalu\s*lintas|macet\s*total|kereta\s*gangguan)\b/i,
      /\b(banjir|hujan\s*deras|hujan\s*lebat|cuaca\s*buruk|cuaca\s*ekstrem|badai|longsor|pohon\s*tumbang|terjebak\s*hujan)\b/i,
      /\b(mati\s*lampu|listrik\s*padam|pemadaman\s*listrik|internet\s*mati|jaringan\s*mati|wifi\s*mati|laptop\s*rusak|kendala\s*teknis)\b/i,
    ],
  },
  {
    category: 'Alasan Kurang Kuat',
    urgency: 'Rendah',
    summary: 'Urgensi Rendah — Alasan pribadi non-darurat, perlu evaluasi ketat asisten.',
    patterns: [
      /\b(ketiduran|bangun\s*kesiangan|kesiangan|telat\s*bangun|lupa\s*jadwal|lupa\s*ada\s*praktikum|malas|mager)\b/i,
      /\b(nongkrong|jalan-jalan|liburan|main\s*game|nonton|reuni|hangout|tidur|mengantuk|capek|lelah)\b/i,
      /\b(urusan\s*pribadi|acara\s*pribadi|janji\s*teman|sibuk|belum\s*siap|belum\s*kerjakan\s*tugas)\b/i,
    ],
  },
];

/**
 * Normalisasi label kategori AI dari sumber eksternal/lokal ke kategori standar.
 */
export function normalizeLeaveAICategory(
  rawCategory?: string | null,
): { category: LeaveAICategory; urgency: LeaveUrgencyLevel; summary: string } | null {
  if (!rawCategory) return null;
  const clean = String(rawCategory).toLowerCase().trim();

  if (clean.includes('sakit') || clean.includes('medis') || clean.includes('kesehatan')) {
    return {
      category: 'Sakit',
      urgency: 'Tinggi',
      summary: 'Urgensi Tinggi — Indikasi kondisi kesehatan atau medis praktikan.',
    };
  }
  if (clean.includes('keluarga') || clean.includes('duka')) {
    return {
      category: 'Urusan Keluarga',
      urgency: 'Tinggi',
      summary: 'Urgensi Tinggi — Kepentingan keluarga mendesak atau kedukaan.',
    };
  }
  if (clean.includes('akademik') || clean.includes('lomba') || clean.includes('kompetisi') || clean.includes('dispensasi')) {
    return {
      category: 'Akademik/Lomba',
      urgency: 'Sedang',
      summary: 'Urgensi Sedang — Kegiatan akademik resmi, delegasi kampus, atau perlombaan.',
    };
  }
  if (clean.includes('teknis') || clean.includes('transportasi') || clean.includes('cuaca') || clean.includes('kendaraan')) {
    return {
      category: 'Kendala Teknis',
      urgency: 'Sedang',
      summary: 'Urgensi Sedang — Kendala transportasi, cuaca ekstrem, atau fasilitas teknis.',
    };
  }
  if (clean.includes('kurang kuat') || clean.includes('lemah') || clean.includes('sepele') || clean.includes('pribadi')) {
    return {
      category: 'Alasan Kurang Kuat',
      urgency: 'Rendah',
      summary: 'Urgensi Rendah — Alasan pribadi non-darurat, perlu evaluasi ketat asisten.',
    };
  }

  return null;
}

/**
 * Klasifikasi lokal berbasis aturan kata kunci Bahasa Indonesia.
 */
export function classifyLeaveReasonLocally(
  reason: string,
): Omit<LeaveAIClassificationResult, 'source'> | null {
  const trimmed = reason.trim();
  if (!trimmed || trimmed.length < 3) {
    return null;
  }

  for (const rule of CATEGORY_RULES) {
    const matched = rule.patterns.some(pattern => pattern.test(trimmed));
    if (matched) {
      return {
        aiClassification: rule.category,
        aiStatus: 'SUCCESS',
        urgency: rule.urgency,
        summary: rule.summary,
      };
    }
  }

  return null;
}

/**
 * Pembuat objek hasil fallback standar ketika AI gagal/timeout/tidak mengenali alasan.
 */
export function createFallbackLeaveClassification(): LeaveAIClassificationResult {
  return {
    aiClassification: FALLBACK_AI_CLASSIFICATION,
    aiStatus: 'FALLBACK',
    urgency: 'Perlu Cek Manual',
    summary: FALLBACK_AI_SUMMARY,
    source: 'fallback',
  };
}

/**
 * Fungsi utama analisis alasan izin praktikan menggunakan AI.
 * - Mencoba endpoint AI eksternal / Gemini API (dengan batas timeout).
 * - Beralih ke classifier lokal Bahasa Indonesia jika endpoint eksternal tidak disetel.
 * - Jika terjadi timeout/error/gagal, mengembalikan FALLBACK ("AI Tidak Merespon / Perlu Cek Manual")
 *   tanpa pernah memblokir penyimpanan pengajuan izin praktikan.
 */
export async function classifyLeaveReason(
  reason: string,
  options: ClassifyLeaveOptions = {},
): Promise<LeaveAIClassificationResult> {
  const trimmed = (reason || '').trim();
  if (!trimmed || options.simulateFailure) {
    return createFallbackLeaveClassification();
  }

  const timeoutMs = options.timeoutMs ?? 4000;

  // 1. Cek Custom AI Endpoint jika dikonfigurasi
  const customEndpoint =
    options.endpointUrl ??
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_AI_LEAVE_URL
      ? process.env.EXPO_PUBLIC_AI_LEAVE_URL
      : undefined);

  if (customEndpoint) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(customEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: trimmed }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        const rawCategory = String(
          data.category ?? data.aiClassification ?? data.classification ?? data.label ?? '',
        );
        const normalized = normalizeLeaveAICategory(rawCategory);
        if (normalized) {
          return {
            aiClassification: normalized.category,
            aiStatus: 'SUCCESS',
            urgency: (data.urgency as LeaveUrgencyLevel) || normalized.urgency,
            summary: String(data.summary ?? normalized.summary),
            source: 'remote_api',
          };
        }
      }
    } catch {
      if (options.disableLocalFallbackClassifier) {
        return createFallbackLeaveClassification();
      }
    }
  }

  // 2. Cek Gemini REST API jika EXPO_PUBLIC_GEMINI_API_KEY dikonfigurasi
  const geminiKey =
    options.geminiApiKey ??
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GEMINI_API_KEY
      ? process.env.EXPO_PUBLIC_GEMINI_API_KEY
      : undefined);

  if (geminiKey) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const prompt = [
        'Klasifikasikan alasan izin praktikum mahasiswa berikut ke dalam SATU kategori ini saja:',
        'Sakit | Urusan Keluarga | Akademik/Lomba | Kendala Teknis | Alasan Kurang Kuat.',
        'Jawab hanya dengan nama kategorinya saja tanpa tanda baca tambahan.',
        `Alasan: "${trimmed}"`,
      ].join('\n');

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timer);

      if (response.ok) {
        const json = (await response.json()) as any;
        const textOutput: string =
          json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const normalized = normalizeLeaveAICategory(textOutput);
        if (normalized) {
          return {
            aiClassification: normalized.category,
            aiStatus: 'SUCCESS',
            urgency: normalized.urgency,
            summary: normalized.summary,
            source: 'remote_api',
          };
        }
      }
    } catch {
      if (options.disableLocalFallbackClassifier) {
        return createFallbackLeaveClassification();
      }
    }
  }

  // 3. Classifier lokal Bahasa Indonesia
  if (!options.disableLocalFallbackClassifier) {
    try {
      const localResult = classifyLeaveReasonLocally(trimmed);
      if (localResult) {
        return {
          ...localResult,
          source: 'local_classifier',
        };
      }
    } catch {
      // Lanjutkan ke fallback aman
    }
  }

  // 4. Fallback aman: Pengajuan tetap disimpan dengan status perlu cek manual oleh Asisten
  return createFallbackLeaveClassification();
}
