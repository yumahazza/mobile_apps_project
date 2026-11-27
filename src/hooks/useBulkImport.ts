/**
 * Yuma — Generic Controlled State Hook `useBulkImport<Row>` (Sprint 4 — S4-Y02)
 *
 * Mengelola siklus hidup state bulk import CSV secara reusable tanpa terikat ke satu koleksi:
 * Pilih/parse file CSV -> Draft baris -> Edit & validasi ulang -> Terima/Tolak -> Commit per baris & Retry aman.
 *
 * Dapat dipakai langsung oleh:
 * - `LaboratoryImportScreen` (Yuma — Master Laboratorium)
 * - `MemberImportScreen` mode Praktikan & mode Asprak (Sela — Membership)
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  BulkCommitBatchResult,
  BulkCommitItemOutcome,
  BulkImportDraftRow,
  BulkImportSummary,
  BulkRowValidator,
} from '@/types/bulkImport';
import {
  applyCommitOutcomesToDraftRows,
  buildInitialDraftRows,
  downloadCsvTemplate,
  getReadyToCommitDraftRows,
  MAX_BULK_IMPORT_ROWS,
  parseCsvContent,
  pickAndReadCsvFile,
  recalculateDraftRows,
  setDraftRowAcceptance,
  summarizeDraftRows,
  updateDraftRowData,
} from '@/services/bulkImportService';

export interface UseBulkImportOptions<Row extends Record<string, string>> {
  /** Daftar nama kolom header CSV yang wajib tersedia. */
  requiredHeaders: readonly (keyof Row & string)[];
  /** Validator per baris (mendukung validasi lintas baris seperti deteksi duplikat). */
  validateRow: BulkRowValidator<Row>;
  /** Normalisasi sel opsional saat CSV dibaca atau field diedit. */
  normalizeCell?: (key: keyof Row & string, rawValue: string) => string;
  /** Nama file template CSV saat diunduh (mis. `template_laboratorium.csv`). */
  templateFileName: string;
  /** Fungsi pembentuk atau string isi file template CSV. */
  getTemplateCsvContent: () => string;
  /** Batas jumlah baris maksimal per file. Default: `200`. */
  maxRows?: number;
  /** Prefix ID lokal untuk `FlatList.keyExtractor`. */
  idPrefix?: string;
}

export interface UseBulkImportReturn<Row extends Record<string, string>> {
  rows: BulkImportDraftRow<Row>[];
  summary: BulkImportSummary;
  fileName: string | null;
  parseError: string | null;
  pickingFile: boolean;
  downloadingTemplate: boolean;
  submitting: boolean;
  lastCommitResult: BulkCommitBatchResult | null;
  loadCsvText: (csvContent: string, sourceFileName?: string) => boolean;
  pickCsvFile: () => Promise<boolean>;
  downloadTemplate: () => Promise<{ ok: boolean; message?: string }>;
  onRowChange: (localId: string, updatedFields: Partial<Row>) => void;
  onAcceptChange: (localId: string, accepted: boolean) => void;
  runCommit: (
    commitHandler: (
      readyRows: BulkImportDraftRow<Row>[],
    ) => Promise<BulkCommitItemOutcome[]>,
  ) => Promise<BulkCommitBatchResult | null>;
  clearParseError: () => void;
  reset: () => void;
}

export function useBulkImport<Row extends Record<string, string>>(
  options: UseBulkImportOptions<Row>,
): UseBulkImportReturn<Row> {
  const {
    requiredHeaders,
    validateRow,
    normalizeCell,
    templateFileName,
    getTemplateCsvContent,
    maxRows = MAX_BULK_IMPORT_ROWS,
    idPrefix = 'bulk-row',
  } = options;

  const [rawRows, setRawRows] = useState<BulkImportDraftRow<Row>[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [pickingFile, setPickingFile] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastCommitResult, setLastCommitResult] =
    useState<BulkCommitBatchResult | null>(null);

  const submittingRef = useRef(false);

  // Evaluasi ulang seluruh baris draft secara sinkron terhadap `validateRow` terkini
  // (tanpa cascading render useEffect, kompatibel penuh dengan React 19 Compiler).
  const rows = useMemo(
    () =>
      rawRows.length === 0 ? rawRows : recalculateDraftRows(rawRows, validateRow),
    [rawRows, validateRow],
  );

  const summary = useMemo(() => summarizeDraftRows(rows), [rows]);

  const loadCsvText = useCallback(
    (csvContent: string, sourceFileName?: string): boolean => {
      setParseError(null);
      setLastCommitResult(null);

      const parsed = parseCsvContent<Row>(csvContent, {
        requiredHeaders,
        fileName: sourceFileName,
        maxRows,
        normalizeCell,
      });

      if (!parsed.ok) {
        setRawRows([]);
        setFileName(sourceFileName ?? null);
        setParseError(parsed.message);
        return false;
      }

      const initialDrafts = buildInitialDraftRows(
        parsed.rows,
        validateRow,
        idPrefix,
      );
      setRawRows(initialDrafts);
      setFileName(sourceFileName ?? 'data_import.csv');
      return true;
    },
    [idPrefix, maxRows, normalizeCell, requiredHeaders, validateRow],
  );

  const pickCsvFile = useCallback(async (): Promise<boolean> => {
    if (pickingFile || submittingRef.current) return false;
    setPickingFile(true);
    setParseError(null);

    try {
      const picked = await pickAndReadCsvFile();
      if (picked.status === 'canceled') {
        return false;
      }
      if (picked.status === 'error') {
        setParseError(picked.message);
        return false;
      }

      return loadCsvText(picked.content, picked.fileName);
    } finally {
      setPickingFile(false);
    }
  }, [loadCsvText, pickingFile]);

  const downloadTemplate = useCallback(async (): Promise<{
    ok: boolean;
    message?: string;
  }> => {
    if (downloadingTemplate) {
      return { ok: false, message: 'Unduhan template sedang diproses.' };
    }
    setDownloadingTemplate(true);
    try {
      const content = getTemplateCsvContent();
      const result = await downloadCsvTemplate(templateFileName, content);
      if (!result.ok) {
        return { ok: false, message: result.message };
      }
      return { ok: true };
    } finally {
      setDownloadingTemplate(false);
    }
  }, [downloadingTemplate, getTemplateCsvContent, templateFileName]);

  const onRowChange = useCallback(
    (localId: string, updatedFields: Partial<Row>) => {
      const normalizedPatch: Partial<Row> = {};
      for (const [k, val] of Object.entries(updatedFields)) {
        if (val !== undefined) {
          const typedKey = k as keyof Row & string;
          normalizedPatch[typedKey] = (
            normalizeCell ? normalizeCell(typedKey, String(val)) : String(val)
          ) as Row[keyof Row & string];
        }
      }

      setRawRows((prev) =>
        updateDraftRowData(prev, localId, normalizedPatch, validateRow),
      );
    },
    [normalizeCell, validateRow],
  );

  const onAcceptChange = useCallback((localId: string, accepted: boolean) => {
    setRawRows((prev) => setDraftRowAcceptance(prev, localId, accepted));
  }, []);

  const runCommit = useCallback(
    async (
      commitHandler: (
        readyRows: BulkImportDraftRow<Row>[],
      ) => Promise<BulkCommitItemOutcome[]>,
    ): Promise<BulkCommitBatchResult | null> => {
      if (submittingRef.current) return null;

      const readyRows = getReadyToCommitDraftRows(rows);
      if (readyRows.length === 0) {
        return null;
      }

      submittingRef.current = true;
      setSubmitting(true);
      try {
        const outcomes = await commitHandler(readyRows);
        const applied = applyCommitOutcomesToDraftRows(rows, outcomes);
        setRawRows(applied.rows);
        const batchSummary: BulkCommitBatchResult = {
          outcomes: applied.outcomes,
          succeededCount: applied.succeededCount,
          failedCount: applied.failedCount,
        };
        setLastCommitResult(batchSummary);
        return batchSummary;
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [rows],
  );

  const clearParseError = useCallback(() => {
    setParseError(null);
  }, []);

  const reset = useCallback(() => {
    if (submittingRef.current) return;
    setRawRows([]);
    setFileName(null);
    setParseError(null);
    setLastCommitResult(null);
  }, []);

  return {
    rows,
    summary,
    fileName,
    parseError,
    pickingFile,
    downloadingTemplate,
    submitting,
    lastCommitResult,
    loadCsvText,
    pickCsvFile,
    downloadTemplate,
    onRowChange,
    onAcceptChange,
    runCommit,
    clearParseError,
    reset,
  };
}
