/**
 * Yuma — Core Pure Logic untuk Bulk Import CSV & Schema Laboratorium (Sprint 4 — S4-Y02)
 *
 * Modul ini 100% murni TypeScript tanpa ketergantungan native (`react-native` / `expo-*`),
 * sehingga dapat dijalankan langsung di:
 * - Aplikasi mobile Android/iOS & Expo Web (melalui `bulkImportService.ts` & `useBulkImport.ts`)
 * - Pengujian otomatis Node.js (`scripts/test-sprint4-bulk.js`)
 * - Backend / Cloud Functions di tahap selanjutnya tanpa menyalin ulang aturan validasi
 */
import Papa from 'papaparse';
import type {
  BulkCommitBatchResult,
  BulkCommitItemOutcome,
  BulkImportColumn,
  BulkImportDraftRow,
  BulkImportSummary,
  BulkRowValidationResult,
  BulkRowValidator,
  CsvParseResult,
  LaboratoryBulkRow,
  ValidatedLaboratoryBulkPayload,
} from '../types/bulkImport';

export const MAX_BULK_IMPORT_ROWS = 200;

export const LABORATORY_CSV_TEMPLATE_FILENAME = 'template_laboratorium.csv';

export const LABORATORY_BULK_HEADERS: readonly (keyof LaboratoryBulkRow & string)[] = [
  'laboratoryCode',
  'name',
  'building',
  'floor',
  'latitude',
  'longitude',
  'radius',
  'gracePeriodMinutes',
  'fineAmount',
];

export const LAB_CODE_MIN_LENGTH = 2;
export const LAB_CODE_MAX_LENGTH = 20;
export const LAB_CODE_PATTERN = /^(?=.*[A-Z0-9])[A-Z0-9-]{2,20}$/;

export const MIN_LAB_RADIUS_METERS = 5;
export const MAX_LAB_RADIUS_METERS = 5000;

export const MIN_LAB_GRACE_MINUTES = 0;
export const MAX_LAB_GRACE_MINUTES = 180;

export const MIN_LAB_FINE_AMOUNT_IDR = 10_000;
export const MAX_LAB_FINE_AMOUNT_IDR = 50_000;

/** Internal key khusus jika jumlah kolom CSV pada suatu baris melebihi jumlah kolom header. */
const EXTRA_CELLS_INTERNAL_WARNING = '__extraCellsCount';

/**
 * Menghapus UTF-8 Byte Order Mark (`\uFEFF`) di awal file CSV jika ada.
 */
export function stripUtf8Bom(raw: string): string {
  if (!raw) return '';
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

/**
 * Normalisasi kode laboratorium: trim spasi dan ubah huruf menjadi kapital.
 */
export function normalizeLaboratoryCode(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase();
}

/**
 * Membentuk ID dokumen Firestore yang deterministik untuk satu pasangan `(courseId, laboratoryCode)`
 * agar impor ulang / retry tidak pernah menggandakan laboratorium pada mata kuliah yang sama.
 */
export function buildDeterministicLaboratoryId(
  courseId: string,
  laboratoryCode: string,
): string {
  const cleanCourse = String(courseId ?? '')
    .trim()
    .replace(/[\/\s]+/g, '-');
  const cleanCode = normalizeLaboratoryCode(laboratoryCode).replace(/[\/\s]+/g, '-');
  if (!cleanCourse || !cleanCode) {
    throw new Error('courseId dan laboratoryCode wajib diisi untuk membuat ID laboratorium.');
  }
  return `${cleanCourse}_${cleanCode}`;
}

/**
 * Format angka Rupiah secara konsisten tanpa bergantung pada locale perangkat yang berbeda-beda.
 */
export function formatRupiahDisplay(amount: number): string {
  if (!Number.isFinite(amount)) return 'Rp0';
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}Rp${grouped}`;
}

/**
 * Parsing angka desimal (mendukung titik atau koma tunggal).
 */
export function parseDecimalValue(raw: string | number): number | null {
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
 * Parsing bilangan bulat non-negatif secara ketat (menolak desimal, huruf, atau simbol).
 */
export function parseStrictIntegerValue(raw: string | number): number | null {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) ? raw : null;
  }
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  if (!/^[+-]?\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export interface ParseCsvOptions<Row extends Record<string, string>> {
  requiredHeaders: readonly (keyof Row & string)[];
  fileName?: string;
  maxRows?: number;
  normalizeCell?: (key: keyof Row & string, rawValue: string) => string;
}

/**
 * Mem-parsing teks CSV menggunakan `papaparse` (mendukung quoted fields, koma di dalam kutip,
 * baris baru di dalam kutip, BOM UTF-8, serta pemisah `,` atau `;` dari ekspor Excel).
 */
export function parseCsvContent<Row extends Record<string, string>>(
  rawContent: string,
  options: ParseCsvOptions<Row>,
): CsvParseResult<Row> {
  const maxRows = options.maxRows ?? MAX_BULK_IMPORT_ROWS;
  const requiredHeaders = options.requiredHeaders;
  const cleaned = stripUtf8Bom(String(rawContent ?? ''));

  if (!cleaned.trim()) {
    return {
      ok: false,
      code: 'EMPTY_FILE',
      message:
        'File CSV kosong. Unduh template CSV terlebih dahulu lalu isi minimal satu baris data.',
    };
  }

  const parsed = Papa.parse<string[]>(cleaned, {
    header: false,
    skipEmptyLines: false,
    delimitersToGuess: [',', ';'],
  });

  const quoteError = parsed.errors.find((err) => err.type === 'Quotes');
  if (quoteError) {
    const lineInfo =
      typeof quoteError.row === 'number' ? ` pada sekitar baris ${quoteError.row + 1}` : '';
    return {
      ok: false,
      code: 'MALFORMED_CSV',
      message: `Format CSV tidak valid${lineInfo}: tanda kutip ganda tidak tertutup dengan benar.`,
    };
  }

  const rawMatrix = parsed.data ?? [];
  // Temukan baris header pertama yang tidak kosong pada akhir/awal file
  let headerRowIndex = -1;
  for (let i = 0; i < rawMatrix.length; i += 1) {
    const candidate = rawMatrix[i];
    if (
      Array.isArray(candidate) &&
      !(candidate.length === 1 && candidate[0].trim() === '')
    ) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return {
      ok: false,
      code: 'EMPTY_FILE',
      message: 'File CSV tidak memiliki baris header maupun data.',
    };
  }

  const rawHeaders = rawMatrix[headerRowIndex].map((cell, idx) => {
    const text = idx === 0 ? stripUtf8Bom(String(cell ?? '')) : String(cell ?? '');
    return text.trim();
  });

  // Cek duplikasi kolom di baris header
  const seenHeaders = new Set<string>();
  const duplicateHeaders: string[] = [];
  for (const h of rawHeaders) {
    if (!h) continue;
    if (seenHeaders.has(h)) {
      duplicateHeaders.push(h);
    }
    seenHeaders.add(h);
  }
  if (duplicateHeaders.length > 0) {
    return {
      ok: false,
      code: 'MALFORMED_CSV',
      message: `Baris header CSV memiliki nama kolom ganda: ${Array.from(new Set(duplicateHeaders)).join(', ')}.`,
    };
  }

  const missingHeaders = requiredHeaders.filter((req) => !rawHeaders.includes(req));
  if (missingHeaders.length > 0) {
    const extraHeaders = rawHeaders.filter(
      (h) => Boolean(h) && !requiredHeaders.includes(h as keyof Row & string),
    );
    return {
      ok: false,
      code: 'MISSING_HEADERS',
      missingHeaders: [...missingHeaders],
      extraHeaders,
      message: `Header CSV tidak sesuai template. Kolom wajib yang belum ditemukan: ${missingHeaders.join(', ')}.`,
    };
  }

  const headerIndexMap = new Map<keyof Row & string, number>();
  for (const reqKey of requiredHeaders) {
    headerIndexMap.set(reqKey, rawHeaders.indexOf(reqKey));
  }

  const rows: { rowNumber: number; data: Row }[] = [];
  let skippedEmptyLines = 0;

  for (let i = headerRowIndex + 1; i < rawMatrix.length; i += 1) {
    const cells = rawMatrix[i];
    if (!Array.isArray(cells)) continue;

    // Baris newline kosong murni (misal baris kosong di akhir file `\r\n`) diabaikan
    if (cells.length === 1 && String(cells[0] ?? '').trim() === '') {
      skippedEmptyLines += 1;
      continue;
    }

    const rowObj: Record<string, string> = {};
    for (const key of requiredHeaders) {
      const colIdx = headerIndexMap.get(key) ?? -1;
      const rawVal = colIdx >= 0 && colIdx < cells.length ? String(cells[colIdx] ?? '') : '';
      const trimmedVal = rawVal.trim();
      rowObj[key] = options.normalizeCell
        ? options.normalizeCell(key, trimmedVal)
        : trimmedVal;
    }

    // Jika jumlah sel melebihi header dan sel berlebih tidak kosong (umumnya koma tanpa kutip),
    // tandai agar validator baris dapat memberi pesan jelas ke pengguna.
    if (cells.length > rawHeaders.length) {
      const trailingNonEmpty = cells
        .slice(rawHeaders.length)
        .some((extraCell) => String(extraCell ?? '').trim() !== '');
      if (trailingNonEmpty) {
        rowObj[EXTRA_CELLS_INTERNAL_WARNING] = String(cells.length - rawHeaders.length);
      }
    }

    rows.push({
      rowNumber: rows.length + 1,
      data: rowObj as Row,
    });
  }

  if (rows.length === 0) {
    return {
      ok: false,
      code: 'EMPTY_FILE',
      message: 'File CSV hanya berisi header tanpa baris data untuk diimpor.',
    };
  }

  if (rows.length > maxRows) {
    return {
      ok: false,
      code: 'ROW_LIMIT_EXCEEDED',
      message: `File CSV memiliki ${rows.length} baris data, melebihi batas maksimal ${maxRows} baris per impor.`,
    };
  }

  return {
    ok: true,
    fileName: options.fileName,
    headers: rawHeaders,
    rows,
    skippedEmptyLines,
  };
}

/**
 * Menghasilkan string CSV berformat RFC 4180 menggunakan `Papa.unparse`.
 */
export function generateCsvString<Row extends Record<string, string>>(
  headers: readonly (keyof Row & string)[],
  sampleRows: readonly Row[] = [],
): string {
  const fields = [...headers];
  const data = sampleRows.map((row) => fields.map((key) => String(row[key] ?? '')));
  return Papa.unparse(
    {
      fields,
      data,
    },
    {
      quotes: false,
      newline: '\r\n',
    },
  );
}

/**
 * Sample data fiktif (tanpa data pribadi asli) untuk `template_laboratorium.csv`.
 */
export const LABORATORY_SAMPLE_CSV_ROWS: readonly LaboratoryBulkRow[] = [
  {
    laboratoryCode: 'LAB-KOM-01',
    name: 'Laboratorium Pemrograman 1',
    building: 'Gedung Ilmu Komputer, Sayap Utara',
    floor: '2',
    latitude: '-7.770615',
    longitude: '110.377812',
    radius: '50',
    gracePeriodMinutes: '10',
    fineAmount: '15000',
  },
  {
    laboratoryCode: 'LAB-JAR-02',
    name: 'Laboratorium Jaringan Terpadu',
    building: 'Gedung Ilmu Komputer',
    floor: '3',
    latitude: '-7.770820',
    longitude: '110.377950',
    radius: '40',
    gracePeriodMinutes: '15',
    fineAmount: '20000',
  },
];

/**
 * Menghasilkan isi file `template_laboratorium.csv` siap unduh.
 */
export function buildLaboratoryTemplateCsvContent(): string {
  return generateCsvString<LaboratoryBulkRow>(
    LABORATORY_BULK_HEADERS,
    LABORATORY_SAMPLE_CSV_ROWS,
  );
}

/**
 * Definisi kolom untuk `BulkImportPreview<LaboratoryBulkRow>`.
 */
export const LABORATORY_BULK_COLUMNS: readonly BulkImportColumn<LaboratoryBulkRow>[] = [
  {
    key: 'laboratoryCode',
    label: 'Kode Lab',
    required: true,
    inputType: 'code',
    placeholder: 'Contoh: LAB-KOM-01',
    helperText: '2–20 karakter (huruf kapital A–Z, angka 0–9, atau tanda hubung -).',
  },
  {
    key: 'name',
    label: 'Nama Laboratorium',
    required: true,
    inputType: 'text',
    placeholder: 'Contoh: Laboratorium Pemrograman 1',
    helperText: '2–100 karakter.',
  },
  {
    key: 'building',
    label: 'Gedung',
    required: true,
    inputType: 'text',
    placeholder: 'Contoh: Gedung Ilmu Komputer',
    helperText: 'Maksimal 100 karakter.',
  },
  {
    key: 'floor',
    label: 'Lantai',
    required: true,
    inputType: 'text',
    placeholder: 'Contoh: 2',
    helperText: 'Maksimal 50 karakter.',
  },
  {
    key: 'latitude',
    label: 'Latitude',
    required: true,
    inputType: 'decimal',
    placeholder: '-7.770615',
    helperText: 'Angka desimal antara -90 s.d. 90 (gunakan titik).',
  },
  {
    key: 'longitude',
    label: 'Longitude',
    required: true,
    inputType: 'decimal',
    placeholder: '110.377812',
    helperText: 'Angka desimal antara -180 s.d. 180 (gunakan titik).',
  },
  {
    key: 'radius',
    label: 'Radius Presensi (m)',
    required: true,
    inputType: 'number',
    placeholder: '50',
    helperText: `${MIN_LAB_RADIUS_METERS}–${MAX_LAB_RADIUS_METERS} meter.`,
    formatPreview: (val) => (val ? `${val} m` : '-'),
  },
  {
    key: 'gracePeriodMinutes',
    label: 'Toleransi Terlambat (menit)',
    required: true,
    inputType: 'number',
    placeholder: '10',
    helperText: `Bilangan bulat ${MIN_LAB_GRACE_MINUTES}–${MAX_LAB_GRACE_MINUTES} menit.`,
    formatPreview: (val) => (val !== '' ? `${val} mnt` : '-'),
  },
  {
    key: 'fineAmount',
    label: 'Nominal Denda (Rp)',
    required: true,
    inputType: 'number',
    placeholder: '15000',
    helperText: `Bilangan bulat ${formatRupiahDisplay(MIN_LAB_FINE_AMOUNT_IDR)} – ${formatRupiahDisplay(MAX_LAB_FINE_AMOUNT_IDR)}.`,
    formatPreview: (val) => {
      const parsed = parseStrictIntegerValue(val);
      return parsed !== null ? formatRupiahDisplay(parsed) : val || '-';
    },
  },
];

export interface LaboratoryValidatorOptions {
  /** Daftar kode laboratorium yang sudah terdaftar pada mata kuliah terpilih (create-only check). */
  existingCodesInCourse?: ReadonlySet<string> | readonly string[];
}

/**
 * Normalisasi sel saat file CSV laboratorium dibaca pertama kali atau diedit.
 */
export function normalizeLaboratoryCell(
  key: keyof LaboratoryBulkRow & string,
  rawValue: string,
): string {
  if (key === 'laboratoryCode') {
    return normalizeLaboratoryCode(rawValue);
  }
  return String(rawValue ?? '').trim();
}

/**
 * Membuat validator baris untuk Bulk Insert Master Laboratorium (S4-Y02).
 * Memeriksa:
 * - Baris kosong & kolom berlebih akibat koma tanpa tanda kutip
 * - Format `laboratoryCode` (A–Z, 0–9, `-`, 2–20 karakter)
 * - Duplikasi kode di dalam file CSV yang sama
 * - Konflik kode yang sudah terdaftar pada mata kuliah (`existingCodesInCourse`)
 * - Batas nilai koordinat, radius (5–5000m), toleransi (0–180 menit), dan denda (Rp10.000–Rp50.000)
 */
export function createLaboratoryBulkRowValidator(
  options: LaboratoryValidatorOptions = {},
): BulkRowValidator<LaboratoryBulkRow> {
  const existingSet = new Set<string>(
    Array.from(options.existingCodesInCourse ?? []).map((code) =>
      normalizeLaboratoryCode(code),
    ),
  );

  return (
    row: LaboratoryBulkRow,
    rowIndex: number,
    allRows: readonly LaboratoryBulkRow[],
  ): BulkRowValidationResult<LaboratoryBulkRow> => {
    const fieldErrors: Partial<Record<keyof LaboratoryBulkRow & string, string>> = {};
    const messages: string[] = [];

    const extraCellsWarning = row[EXTRA_CELLS_INTERNAL_WARNING];
    if (extraCellsWarning) {
      messages.push(
        `Terdapat ${extraCellsWarning} kolom berlebih pada baris CSV. Pastikan angka desimal memakai titik (.) atau bungkus teks berkoma dengan tanda kutip.`,
      );
    }

    const allEmpty = LABORATORY_BULK_HEADERS.every(
      (key) => String(row[key] ?? '').trim() === '',
    );
    if (allEmpty) {
      for (const key of LABORATORY_BULK_HEADERS) {
        fieldErrors[key] = 'Wajib diisi.';
      }
      messages.push('Seluruh kolom pada baris ini kosong. Lengkapi data atau tolak baris.');
      return {
        valid: false,
        fieldErrors,
        messages,
      };
    }

    // 1. Kode Laboratorium
    const code = normalizeLaboratoryCode(row.laboratoryCode);
    if (!code) {
      fieldErrors.laboratoryCode = 'Kode laboratorium wajib diisi.';
    } else if (
      code.length < LAB_CODE_MIN_LENGTH ||
      code.length > LAB_CODE_MAX_LENGTH ||
      !LAB_CODE_PATTERN.test(code)
    ) {
      fieldErrors.laboratoryCode =
        'Kode lab harus 2–20 karakter berupa huruf kapital A–Z, angka 0–9, atau tanda hubung (-).';
    } else {
      const duplicateIndices: number[] = [];
      allRows.forEach((otherRow, otherIdx) => {
        if (otherIdx !== rowIndex && normalizeLaboratoryCode(otherRow.laboratoryCode) === code) {
          duplicateIndices.push(otherIdx + 1);
        }
      });

      if (duplicateIndices.length > 0) {
        fieldErrors.laboratoryCode = `Kode "${code}" duplikat di dalam file CSV (sama dengan baris #${duplicateIndices.join(', #')}).`;
      } else if (existingSet.has(code)) {
        fieldErrors.laboratoryCode = `Kode "${code}" sudah terdaftar pada mata kuliah ini. Gunakan form Ubah Lab.`;
      }
    }

    // 2. Nama Laboratorium
    const name = String(row.name ?? '').trim();
    if (!name) {
      fieldErrors.name = 'Nama laboratorium wajib diisi.';
    } else if (name.length < 2) {
      fieldErrors.name = 'Nama laboratorium minimal 2 karakter.';
    } else if (name.length > 100) {
      fieldErrors.name = 'Nama laboratorium maksimal 100 karakter.';
    }

    // 3. Gedung
    const building = String(row.building ?? '').trim();
    if (!building) {
      fieldErrors.building = 'Nama gedung wajib diisi.';
    } else if (building.length > 100) {
      fieldErrors.building = 'Nama gedung maksimal 100 karakter.';
    }

    // 4. Lantai
    const floor = String(row.floor ?? '').trim();
    if (!floor) {
      fieldErrors.floor = 'Lantai wajib diisi.';
    } else if (floor.length > 50) {
      fieldErrors.floor = 'Lantai maksimal 50 karakter.';
    }

    // 5. Latitude
    const latText = String(row.latitude ?? '').trim();
    const parsedLat = parseDecimalValue(latText);
    if (!latText) {
      fieldErrors.latitude = 'Latitude wajib diisi.';
    } else if (parsedLat === null || parsedLat < -90 || parsedLat > 90) {
      fieldErrors.latitude = 'Latitude harus berupa angka desimal antara -90 s.d. 90.';
    }

    // 6. Longitude
    const lngText = String(row.longitude ?? '').trim();
    const parsedLng = parseDecimalValue(lngText);
    if (!lngText) {
      fieldErrors.longitude = 'Longitude wajib diisi.';
    } else if (parsedLng === null || parsedLng < -180 || parsedLng > 180) {
      fieldErrors.longitude = 'Longitude harus berupa angka desimal antara -180 s.d. 180.';
    }

    // 7. Radius Presensi
    const radiusText = String(row.radius ?? '').trim();
    const parsedRadius = parseDecimalValue(radiusText);
    if (!radiusText) {
      fieldErrors.radius = 'Radius presensi wajib diisi.';
    } else if (
      parsedRadius === null ||
      parsedRadius < MIN_LAB_RADIUS_METERS ||
      parsedRadius > MAX_LAB_RADIUS_METERS
    ) {
      fieldErrors.radius = `Radius presensi harus antara ${MIN_LAB_RADIUS_METERS} s.d. ${MAX_LAB_RADIUS_METERS} meter.`;
    }

    // 8. Grace Period (menit, integer 0–180)
    const graceText = String(row.gracePeriodMinutes ?? '').trim();
    const parsedGrace = parseStrictIntegerValue(graceText);
    if (!graceText) {
      fieldErrors.gracePeriodMinutes = 'Toleransi keterlambatan wajib diisi.';
    } else if (
      parsedGrace === null ||
      parsedGrace < MIN_LAB_GRACE_MINUTES ||
      parsedGrace > MAX_LAB_GRACE_MINUTES
    ) {
      fieldErrors.gracePeriodMinutes = `Toleransi keterlambatan harus bilangan bulat ${MIN_LAB_GRACE_MINUTES}–${MAX_LAB_GRACE_MINUTES} menit.`;
    }

    // 9. Nominal Denda (integer Rp10.000–Rp50.000)
    const fineText = String(row.fineAmount ?? '').trim();
    const parsedFine = parseStrictIntegerValue(fineText);
    if (!fineText) {
      fieldErrors.fineAmount = 'Nominal denda wajib diisi.';
    } else if (
      parsedFine === null ||
      parsedFine < MIN_LAB_FINE_AMOUNT_IDR ||
      parsedFine > MAX_LAB_FINE_AMOUNT_IDR
    ) {
      fieldErrors.fineAmount = `Nominal denda harus bilangan bulat ${formatRupiahDisplay(MIN_LAB_FINE_AMOUNT_IDR)} – ${formatRupiahDisplay(MAX_LAB_FINE_AMOUNT_IDR)}.`;
    }

    for (const key of LABORATORY_BULK_HEADERS) {
      const err = fieldErrors[key];
      if (err) {
        messages.push(err);
      }
    }

    return {
      valid: messages.length === 0,
      fieldErrors,
      messages,
    };
  };
}

/**
 * Mengonversi satu `LaboratoryBulkRow` yang sudah lolos validasi menjadi payload numerik siap simpan.
 * Mengembalikan `null` apabila baris masih tidak valid atau `courseId` kosong.
 */
export function toValidatedLaboratoryBulkPayload(
  courseId: string,
  row: LaboratoryBulkRow,
  validator: BulkRowValidator<LaboratoryBulkRow> = createLaboratoryBulkRowValidator(),
  rowIndex = 0,
  allRows: readonly LaboratoryBulkRow[] = [row],
): ValidatedLaboratoryBulkPayload | null {
  const cleanCourseId = String(courseId ?? '').trim();
  if (!cleanCourseId) return null;

  const check = validator(row, rowIndex, allRows);
  if (!check.valid) return null;

  const laboratoryCode = normalizeLaboratoryCode(row.laboratoryCode);
  const latitude = parseDecimalValue(row.latitude);
  const longitude = parseDecimalValue(row.longitude);
  const radius = parseDecimalValue(row.radius);
  const gracePeriodMinutes = parseStrictIntegerValue(row.gracePeriodMinutes);
  const fineAmount = parseStrictIntegerValue(row.fineAmount);

  if (
    latitude === null ||
    longitude === null ||
    radius === null ||
    gracePeriodMinutes === null ||
    fineAmount === null
  ) {
    return null;
  }

  return {
    deterministicId: buildDeterministicLaboratoryId(cleanCourseId, laboratoryCode),
    courseId: cleanCourseId,
    laboratoryCode,
    name: row.name.trim(),
    building: row.building.trim(),
    floor: row.floor.trim(),
    latitude,
    longitude,
    radius: Math.round(radius * 100) / 100,
    gracePeriodMinutes,
    fineAmount,
    active: true,
  };
}

/**
 * Mengecek apakah dokumen laboratorium yang sudah ada identik secara fungsional dengan payload impor.
 * Digunakan untuk menjamin retry idempotent: bila jaringan sempat putus setelah dokumen tertulis,
 * percobaan ulang menganggap baris tersebut sukses tanpa membuat duplikat atau error palsu.
 */
export function isSameLaboratoryBulkPayload(
  existing: Partial<ValidatedLaboratoryBulkPayload> | null | undefined,
  candidate: ValidatedLaboratoryBulkPayload,
): boolean {
  if (!existing) return false;
  return (
    String(existing.courseId ?? '').trim() === candidate.courseId &&
    normalizeLaboratoryCode(String(existing.laboratoryCode ?? '')) ===
      candidate.laboratoryCode &&
    String(existing.name ?? '').trim() === candidate.name &&
    String(existing.building ?? '').trim() === candidate.building &&
    String(existing.floor ?? '').trim() === candidate.floor &&
    Number(existing.latitude) === candidate.latitude &&
    Number(existing.longitude) === candidate.longitude &&
    Number(existing.radius) === candidate.radius &&
    Number(existing.gracePeriodMinutes) === candidate.gracePeriodMinutes &&
    Number(existing.fineAmount) === candidate.fineAmount &&
    existing.active !== false
  );
}

// ============================================================================
// Pure State Transitions untuk Draft Bulk Import (`useBulkImport` & Unit Test)
// ============================================================================

/**
 * Menginisialisasi daftar draft baris dari hasil `parseCsvContent`:
 * - Baris valid otomatis `accepted: true`
 * - Baris invalid otomatis `accepted: false` (tidak bisa disimpan sebelum diperbaiki)
 */
export function buildInitialDraftRows<Row extends Record<string, string>>(
  parsedRows: readonly { rowNumber: number; data: Row }[],
  validateRow: BulkRowValidator<Row>,
  idPrefix = 'bulk-row',
): BulkImportDraftRow<Row>[] {
  const rawDataList = parsedRows.map((item) => item.data);
  return parsedRows.map((item, idx) => {
    const validation = validateRow(item.data, idx, rawDataList);
    return {
      localId: `${idPrefix}-${item.rowNumber}-${idx}`,
      rowNumber: item.rowNumber,
      data: item.data,
      validation,
      accepted: validation.valid,
      manuallyDenied: false,
      commitState: 'pending',
    };
  });
}

/**
 * Mengevaluasi ulang seluruh baris draft terhadap `validateRow` terbaru
 * (penting ketika perubahan 1 baris memperbaiki duplikasi di baris lain, atau saat course berubah).
 */
export function recalculateDraftRows<Row extends Record<string, string>>(
  draftRows: readonly BulkImportDraftRow<Row>[],
  validateRow: BulkRowValidator<Row>,
): BulkImportDraftRow<Row>[] {
  // Hanya baris yang belum committed yang ikut dibandingkan dalam pengecekan duplikat internal batch aktif,
  // atau seluruh baris dalam file tetap dibandingkan agar tidak ada 2 baris di file yang sama memiliki kode sama.
  const allData = draftRows.map((item) => item.data);

  return draftRows.map((item, idx) => {
    if (item.commitState === 'committed') {
      return {
        ...item,
        accepted: false,
      };
    }

    const validation = validateRow(item.data, idx, allData);
    const accepted = validation.valid ? !item.manuallyDenied : false;

    return {
      ...item,
      validation,
      accepted,
    };
  });
}

/**
 * Memperbarui nilai kolom pada satu baris draft yang belum ter-commit,
 * membersihkan warning kolom ekstra internal, lalu menjalankan ulang validasi lintas baris.
 */
export function updateDraftRowData<Row extends Record<string, string>>(
  draftRows: readonly BulkImportDraftRow<Row>[],
  localId: string,
  updatedFields: Partial<Row>,
  validateRow: BulkRowValidator<Row>,
): BulkImportDraftRow<Row>[] {
  const nextDrafts = draftRows.map((item) => {
    if (item.localId !== localId || item.commitState === 'committed') {
      return item;
    }

    const mergedData: Record<string, string> = {
      ...item.data,
    };
    delete mergedData[EXTRA_CELLS_INTERNAL_WARNING];

    for (const [k, v] of Object.entries(updatedFields)) {
      if (v !== undefined) {
        mergedData[k] = String(v);
      }
    }

    return {
      ...item,
      data: mergedData as Row,
      commitState: 'pending' as const,
      commitMessage: undefined,
    };
  });

  return recalculateDraftRows(nextDrafts, validateRow);
}

/**
 * Mengubah status Terima / Tolak (`accepted`) pada satu baris draft.
 * Baris yang tidak valid atau sudah berhasil tersimpan (`committed`) tidak dapat diaktifkan menjadi `accepted = true`.
 */
export function setDraftRowAcceptance<Row extends Record<string, string>>(
  draftRows: readonly BulkImportDraftRow<Row>[],
  localId: string,
  nextAccepted: boolean,
): BulkImportDraftRow<Row>[] {
  return draftRows.map((item) => {
    if (item.localId !== localId || item.commitState === 'committed') {
      return item;
    }

    if (nextAccepted) {
      if (!item.validation.valid) {
        return {
          ...item,
          accepted: false,
        };
      }
      return {
        ...item,
        accepted: true,
        manuallyDenied: false,
      };
    }

    return {
      ...item,
      accepted: false,
      manuallyDenied: true,
    };
  });
}

/**
 * Menyaring hanya baris yang benar-benar siap dikirim (`accepted && valid && commitState !== 'committed'`).
 */
export function getReadyToCommitDraftRows<Row extends Record<string, string>>(
  draftRows: readonly BulkImportDraftRow<Row>[],
): BulkImportDraftRow<Row>[] {
  return draftRows.filter(
    (item) =>
      item.commitState !== 'committed' && item.accepted && item.validation.valid,
  );
}

/**
 * Menerapkan hasil commit per baris (`BulkCommitItemOutcome[]`) ke state draft:
 * - Baris sukses dikunci (`commitState: 'committed'`, `accepted: false`) agar retry tidak menduplikasi
 * - Baris gagal ditandai `commitState: 'failed'` beserta alasan gagalnya, tetap bisa diedit & di-retry
 */
export function applyCommitOutcomesToDraftRows<Row extends Record<string, string>>(
  draftRows: readonly BulkImportDraftRow<Row>[],
  outcomes: readonly BulkCommitItemOutcome[],
): BulkCommitBatchResult & { rows: BulkImportDraftRow<Row>[] } {
  const outcomeMap = new Map<string, BulkCommitItemOutcome>();
  for (const outcome of outcomes) {
    outcomeMap.set(outcome.localId, outcome);
  }

  let succeededCount = 0;
  let failedCount = 0;

  const updatedRows = draftRows.map((item) => {
    const outcome = outcomeMap.get(item.localId);
    if (!outcome) return item;

    if (outcome.success) {
      succeededCount += 1;
      return {
        ...item,
        accepted: false,
        commitState: 'committed' as const,
        commitMessage: outcome.message ?? 'Berhasil disimpan.',
      };
    }

    failedCount += 1;
    return {
      ...item,
      accepted: item.validation.valid && !item.manuallyDenied,
      commitState: 'failed' as const,
      commitMessage: outcome.message ?? 'Gagal menyimpan baris ini.',
    };
  });

  return {
    rows: updatedRows,
    outcomes: [...outcomes],
    succeededCount,
    failedCount,
  };
}

/**
 * Menghitung metrik ringkasan (`BulkImportSummary`) dari state draft saat ini.
 */
export function summarizeDraftRows<Row extends Record<string, string>>(
  draftRows: readonly BulkImportDraftRow<Row>[],
): BulkImportSummary {
  let validRows = 0;
  let invalidRows = 0;
  let deniedRows = 0;
  let readyToCommitRows = 0;
  let committedRows = 0;
  let failedCommitRows = 0;

  for (const row of draftRows) {
    if (row.validation.valid) {
      validRows += 1;
    } else {
      invalidRows += 1;
    }

    if (row.manuallyDenied && row.commitState !== 'committed') {
      deniedRows += 1;
    }

    if (row.commitState === 'committed') {
      committedRows += 1;
    } else if (row.commitState === 'failed') {
      failedCommitRows += 1;
    }

    if (row.commitState !== 'committed' && row.accepted && row.validation.valid) {
      readyToCommitRows += 1;
    }
  }

  return {
    totalRows: draftRows.length,
    validRows,
    invalidRows,
    deniedRows,
    readyToCommitRows,
    committedRows,
    failedCommitRows,
  };
}
