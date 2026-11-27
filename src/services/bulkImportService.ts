/**
 * Yuma — Bulk Import Service (Sprint 4 — S4-Y02)
 *
 * Menyediakan:
 * 1. Re-export seluruh utilitas murni parser CSV, generator template, state draft, dan validator lab
 *    dari `bulkImportCore.ts` (agar Sela maupun komponen UI cukup mengimpor dari `bulkImportService`).
 * 2. Adapter lintas platform (Android / iOS Dev Build + Expo Web) untuk:
 *    - Mengunduh / membagikan file template CSV (`downloadCsvTemplate`)
 *    - Memilih & membaca isi file CSV dari perangkat pengguna (`pickAndReadCsvFile`)
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  buildLaboratoryTemplateCsvContent,
  LABORATORY_CSV_TEMPLATE_FILENAME,
} from './bulkImportCore';

export * from './bulkImportCore';

export type CsvFilePickOutcome =
  | {
      status: 'picked';
      fileName: string;
      content: string;
      sizeBytes?: number;
    }
  | {
      status: 'canceled';
    }
  | {
      status: 'error';
      message: string;
    };

export type CsvDownloadOutcome =
  | {
      ok: true;
      fileName: string;
      uri?: string;
    }
  | {
      ok: false;
      message: string;
    };

const CSV_MIME_TYPES: string[] = [
  'text/csv',
  'text/comma-separated-values',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
];

function sanitizeCsvFileName(rawName: string): string {
  const base = String(rawName ?? 'template.csv')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.toLowerCase().endsWith('.csv') ? base : `${base}.csv`;
}

/**
 * Mengunduh / mengekspor file template CSV dalam pengodean UTF-8 (dengan BOM agar Excel membaca kolom dengan rapi):
 * - Pada **Web**: membuat `Blob` UTF-8 dan memicu unduhan langsung di browser (`<a download>`).
 * - Pada **Android / iOS**: menulis file ke direktori cache aplikasi menggunakan `expo-file-system` (`File` API SDK 58),
 *   lalu membuka lembar simpan/bagikan sistem melalui `expo-sharing`.
 */
export async function downloadCsvTemplate(
  fileName: string,
  csvContent: string,
): Promise<CsvDownloadOutcome> {
  const safeFileName = sanitizeCsvFileName(fileName);
  const utf8WithBom = csvContent.startsWith('\uFEFF')
    ? csvContent
    : `\uFEFF${csvContent}`;

  try {
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined' || typeof Blob === 'undefined') {
        return {
          ok: false,
          message: 'Lingkungan browser tidak mendukung pengunduhan file secara langsung.',
        };
      }

      const blob = new Blob([utf8WithBom], {
        type: 'text/csv;charset=utf-8;',
      });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = safeFileName;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);

      return {
        ok: true,
        fileName: safeFileName,
      };
    }

    const targetFile = new ExpoFile(Paths.cache, safeFileName);
    targetFile.create({ overwrite: true, intermediates: true });
    await targetFile.write(utf8WithBom, { encoding: 'utf8' });

    const sharingAvailable = await Sharing.isAvailableAsync();
    if (!sharingAvailable) {
      return {
        ok: false,
        message:
          'Fitur simpan/bagikan file tidak tersedia pada perangkat ini. Pastikan menggunakan Development Build.',
      };
    }

    await Sharing.shareAsync(targetFile.uri, {
      mimeType: 'text/csv',
      dialogTitle: `Simpan ${safeFileName}`,
      UTI: 'public.comma-separated-values-text',
    });

    return {
      ok: true,
      fileName: safeFileName,
      uri: targetFile.uri,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Kesalahan tidak diketahui.';
    return {
      ok: false,
      message: `Gagal menyiapkan file template "${safeFileName}": ${detail}`,
    };
  }
}

/**
 * Shortcut khusus untuk mengunduh `template_laboratorium.csv` (S4-Y02).
 */
export async function downloadLaboratoryCsvTemplate(): Promise<CsvDownloadOutcome> {
  return downloadCsvTemplate(
    LABORATORY_CSV_TEMPLATE_FILENAME,
    buildLaboratoryTemplateCsvContent(),
  );
}

/**
 * Membuka pemilih dokumen sistem (`expo-document-picker`) dan membaca isi teks UTF-8 dari file CSV yang dipilih.
 * Mendukung Android/iOS (melalui `expo-file-system` `File.text()`) maupun Web (`asset.file.text()` / `fetch(asset.uri)`).
 */
export async function pickAndReadCsvFile(): Promise<CsvFilePickOutcome> {
  try {
    const pickResult = await DocumentPicker.getDocumentAsync({
      type: CSV_MIME_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (pickResult.canceled || !pickResult.assets || pickResult.assets.length === 0) {
      return { status: 'canceled' };
    }

    const asset = pickResult.assets[0];
    const fileName = asset.name || 'data_import.csv';

    // Validasi ekstensi dasar untuk menolak file biner yang jelas salah format (mis. .xlsx, .pdf, .png)
    const lowerName = fileName.toLowerCase();
    if (
      lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.xls') ||
      lowerName.endsWith('.pdf') ||
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.zip')
    ) {
      return {
        status: 'error',
        message: `File "${fileName}" bukan berformat CSV (.csv). Simpan file spreadsheet sebagai CSV UTF-8 terlebih dahulu.`,
      };
    }

    if (Platform.OS === 'web') {
      if (asset.file && typeof asset.file.text === 'function') {
        const content = await asset.file.text();
        return {
          status: 'picked',
          fileName,
          content,
          sizeBytes: asset.size,
        };
      }

      const response = await fetch(asset.uri);
      const content = await response.text();
      return {
        status: 'picked',
        fileName,
        content,
        sizeBytes: asset.size,
      };
    }

    const localFile = new ExpoFile(asset.uri);
    const content = await localFile.text();
    return {
      status: 'picked',
      fileName,
      content,
      sizeBytes: asset.size,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Gagal membaca file.';
    return {
      status: 'error',
      message: `Tidak dapat membaca file CSV yang dipilih: ${detail}`,
    };
  }
}
