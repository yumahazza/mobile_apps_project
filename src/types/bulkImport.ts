/**
 * Yuma — Generic & Laboratory Bulk Import Contracts (Sprint 4 — S4-Y02)
 *
 * Dirancang generik agar dapat digunakan bersama oleh tiga alur impor terpisah:
 * 1. Bulk Insert Laboratorium (Yuma — `LaboratoryBulkRow`)
 * 2. Bulk Insert Praktikan (Sela — schema & validator terpisah)
 * 3. Bulk Insert Asprak (Sela — schema & validator terpisah)
 *
 * Catatan arsitektur:
 * - Komponen UI (`BulkImportPreview`) murni presentational & controlled:
 *   TIDAK menulis langsung ke Firestore dan TIDAK mengambil keputusan otorisasi.
 * - Setiap menu wajib menyediakan `columns`, `validateRow`, template CSV, dan handler `onConfirm` masing-masing.
 */

export type BulkColumnInputType = 'text' | 'number' | 'decimal' | 'code' | 'email';

/**
 * Definisi kolom untuk tabel/kartu preview & form edit per baris pada `BulkImportPreview<Row>`.
 */
export interface BulkImportColumn<Row extends Record<string, string>> {
  /** Nama properti pada objek `Row` (harus sama dengan nama header CSV). */
  key: keyof Row & string;
  /** Label manusiawi untuk ditampilkan pada kartu preview & modal edit. */
  label: string;
  /** Wajib diisi atau opsional. Default: `true`. */
  required?: boolean;
  /** Placeholder saat field kosong di modal edit. */
  placeholder?: string;
  /** Teks bantuan singkat di bawah input pada modal edit (mis. rentang nilai). */
  helperText?: string;
  /** Jenis keyboard / normalisasi input pada modal edit. Default: `'text'`. */
  inputType?: BulkColumnInputType;
  /** Format tampilan ringkas pada kartu preview (opsional, mis. format Rupiah / satuan meter). */
  formatPreview?: (value: string, row: Row) => string;
}

/**
 * Hasil validasi satu baris pada `validateRow`.
 */
export interface BulkRowValidationResult<Row extends Record<string, string>> {
  /** `true` bila seluruh kolom wajib terisi, format valid, dan tidak duplikat/konflik. */
  valid: boolean;
  /** Pesan error spesifik per kolom (untuk highlight merah di modal edit & kartu). */
  fieldErrors: Partial<Record<keyof Row & string, string>>;
  /** Daftar pesan ringkas tingkat baris (ditampilkan langsung pada kartu preview). */
  messages: string[];
}

/**
 * Fungsi validator generik per baris.
 * Menerima baris saat ini, indeks baris, dan seluruh baris aktif agar dapat mendeteksi duplikat antar-baris.
 */
export type BulkRowValidator<Row extends Record<string, string>> = (
  row: Row,
  rowIndex: number,
  allRows: readonly Row[],
) => BulkRowValidationResult<Row>;

/**
 * Status siklus hidup satu baris di dalam sesi preview & commit.
 * - `'pending'`: belum dikirim ke penyimpanan / masih tahap review
 * - `'committed'`: sudah berhasil disimpan (dikunci agar retry tidak menduplikasi)
 * - `'failed'`: gagal saat commit ke backend/Firestore (masih bisa diedit & dikirim ulang)
 */
export type BulkRowCommitState = 'pending' | 'committed' | 'failed';

/**
 * Representasi satu baris draft pada state `useBulkImport<Row>` dan `BulkImportPreview<Row>`.
 */
export interface BulkImportDraftRow<Row extends Record<string, string>> {
  /** ID lokal unik & stabil untuk `FlatList.keyExtractor`. */
  localId: string;
  /** Nomor baris asal pada file CSV (1-based terhadap baris data, setelah header). */
  rowNumber: number;
  /** Nilai mentah/teredit per kolom (seluruhnya string agar input kosong/invalid tetap bisa diedit). */
  data: Row;
  /** Hasil validasi terkini dari `validateRow`. */
  validation: BulkRowValidationResult<Row>;
  /** Apakah baris disetujui Aslab untuk ikut di-commit (`false` otomatis bila `!validation.valid`). */
  accepted: boolean;
  /** Menandai apakah Aslab secara eksplisit menolak baris ini melalui toggle Tolak. */
  manuallyDenied: boolean;
  /** Status pengiriman baris setelah tombol konfirmasi ditekan. */
  commitState: BulkRowCommitState;
  /** Pesan hasil commit per baris (mis. alasan gagal dari server/rules atau konfirmasi sukses). */
  commitMessage?: string;
}

/**
 * Ringkasan metrik seluruh baris draft untuk ditampilkan pada panel ringkasan `BulkImportPreview`.
 */
export interface BulkImportSummary {
  /** Total baris data yang diimpor dari CSV. */
  totalRows: number;
  /** Baris yang lolos validasi (`validation.valid === true`). */
  validRows: number;
  /** Baris yang masih memiliki kolom kosong/invalid/duplikat (`validation.valid === false`). */
  invalidRows: number;
  /** Baris yang ditolak secara manual oleh Aslab (`manuallyDenied === true`). */
  deniedRows: number;
  /** Baris yang siap dikirim sekarang (`accepted && validation.valid && commitState !== 'committed'`). */
  readyToCommitRows: number;
  /** Baris yang sudah berhasil tersimpan pada sesi ini. */
  committedRows: number;
  /** Baris yang gagal tersimpan pada percobaan commit terakhir. */
  failedCommitRows: number;
}

/**
 * Hasil commit per baris yang dikembalikan oleh callback `onConfirm` milik layar pemanggil.
 */
export interface BulkCommitItemOutcome {
  /** `localId` dari `BulkImportDraftRow` yang diproses. */
  localId: string;
  /** `true` bila baris berhasil disimpan (termasuk idempotent retry untuk dokumen identik). */
  success: boolean;
  /** ID dokumen tujuan bila berhasil (opsional). */
  documentId?: string;
  /** Pesan sukses atau alasan kegagalan spesifik per baris. */
  message?: string;
}

/**
 * Hasil agregat pemanggilan commit batch.
 */
export interface BulkCommitBatchResult {
  outcomes: BulkCommitItemOutcome[];
  succeededCount: number;
  failedCount: number;
}

/**
 * Kontrak hasil parsing CSV generik dari `bulkImportService`.
 */
export interface CsvParseSuccess<Row extends Record<string, string>> {
  ok: true;
  fileName?: string;
  headers: string[];
  rows: { rowNumber: number; data: Row }[];
  skippedEmptyLines: number;
}

export type CsvParseErrorCode =
  | 'EMPTY_FILE'
  | 'MISSING_HEADERS'
  | 'ROW_LIMIT_EXCEEDED'
  | 'MALFORMED_CSV';

export interface CsvParseFailure {
  ok: false;
  code: CsvParseErrorCode;
  message: string;
  missingHeaders?: string[];
  extraHeaders?: string[];
}

export type CsvParseResult<Row extends Record<string, string>> =
  | CsvParseSuccess<Row>
  | CsvParseFailure;

/**
 * Schema baris CSV untuk Bulk Insert Master Laboratorium (S4-Y02).
 * Header wajib:
 * `laboratoryCode,name,building,floor,latitude,longitude,radius,gracePeriodMinutes,fineAmount`
 */
export interface LaboratoryBulkRow extends Record<string, string> {
  laboratoryCode: string;
  name: string;
  building: string;
  floor: string;
  latitude: string;
  longitude: string;
  radius: string;
  gracePeriodMinutes: string;
  fineAmount: string;
}

/**
 * Payload laboratorium yang sudah tervalidasi & ternormalisasi ke tipe numerik siap simpan,
 * untuk satu mata kuliah (`courseId`).
 */
export interface ValidatedLaboratoryBulkPayload {
  deterministicId: string;
  courseId: string;
  laboratoryCode: string;
  name: string;
  building: string;
  floor: string;
  latitude: number;
  longitude: number;
  radius: number;
  gracePeriodMinutes: number;
  fineAmount: number;
  active: boolean;
}
