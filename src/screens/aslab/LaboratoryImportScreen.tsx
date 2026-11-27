/**
 * Yuma — LaboratoryImportScreen (Sprint 4 — S4-Y02)
 *
 * Layar mandiri untuk Bulk Insert Master Laboratorium oleh Aslab:
 * - Memilih 1 mata kuliah cakupan sebelum mengimpor (1 bulk = 1 mata kuliah)
 * - Mengunduh `template_laboratorium.csv` (UTF-8)
 * - Memilih & mem-parsing file CSV menggunakan `papaparse`
 * - Menampilkan `BulkImportPreview<LaboratoryBulkRow>` (validasi, edit modal, terima/tolak)
 *
 * Catatan integrasi bertahap:
 * - Penulisan ke Firestore didelegasikan melalui prop `onCommitRows` (adapter terpisah)
 *   agar tetap aman sambil menunggu role `aslab` & Security Rules final dari Hana (S4-H01/H02).
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NavigationProp } from '@/navigation/navigationTypes';
import type {
  BulkCommitItemOutcome,
  BulkImportDraftRow,
  LaboratoryBulkRow,
  ValidatedLaboratoryBulkPayload,
} from '@/types/bulkImport';
import {
  buildLaboratoryTemplateCsvContent,
  createLaboratoryBulkRowValidator,
  LABORATORY_BULK_COLUMNS,
  LABORATORY_BULK_HEADERS,
  LABORATORY_CSV_TEMPLATE_FILENAME,
  normalizeLaboratoryCell,
  toValidatedLaboratoryBulkPayload,
} from '@/services/bulkImportService';
import { useBulkImport } from '@/hooks/useBulkImport';
import { showMessage } from '@/services/dialogService';
import { AppHeader } from '@/components/AppHeader';
import { BulkImportPreview } from '@/components/BulkImportPreview';
import { CustomButton } from '@/components/CustomButton';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import {
  APP_COLORS,
  APP_FONTS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

export interface CourseScopeOption {
  id: string;
  code?: string;
  name: string;
}

export interface LaboratoryImportScreenProps {
  navigation: NavigationProp;
  /** Daftar mata kuliah yang dikelola Aslab (diisi dari `courses` / `user.courseIds` setelah H01/H02 siap). */
  courses?: readonly CourseScopeOption[];
  /** ID mata kuliah awal bila layar dibuka dari konteks mata kuliah tertentu. */
  initialCourseId?: string;
  /** Pemetaan `courseId -> daftar laboratoryCode existing` untuk validasi create-only di preview. */
  existingCodesByCourse?: Readonly<Record<string, readonly string[]>>;
  /**
   * Adapter commit ke Firestore / backend.
   * Sengaja opsional hingga H01/H02 (role `aslab` & Security Rules) terpasang.
   */
  onCommitRows?: (
    courseId: string,
    payloads: ValidatedLaboratoryBulkPayload[],
    draftRows: BulkImportDraftRow<LaboratoryBulkRow>[],
  ) => Promise<BulkCommitItemOutcome[]>;
}

export const LaboratoryImportScreen: React.FC<LaboratoryImportScreenProps> = ({
  navigation,
  courses,
  initialCourseId,
  existingCodesByCourse,
  onCommitRows,
}) => {
  const paramCourses = navigation.params?.courses as
    | readonly CourseScopeOption[]
    | undefined;
  const availableCourses = courses ?? paramCourses ?? [];

  const defaultCourseId =
    initialCourseId ??
    (navigation.params?.courseId as string | undefined) ??
    availableCourses[0]?.id ??
    '';

  const [selectedCourseId, setSelectedCourseId] = useState<string>(defaultCourseId);

  const existingCodesInSelectedCourse = useMemo(() => {
    const trimmedCourse = selectedCourseId.trim();
    if (!trimmedCourse || !existingCodesByCourse) return [];
    return existingCodesByCourse[trimmedCourse] ?? [];
  }, [existingCodesByCourse, selectedCourseId]);

  const validateLaboratoryRow = useMemo(
    () =>
      createLaboratoryBulkRowValidator({
        existingCodesInCourse: existingCodesInSelectedCourse,
      }),
    [existingCodesInSelectedCourse],
  );

  const {
    rows,
    summary,
    fileName,
    parseError,
    pickingFile,
    downloadingTemplate,
    submitting,
    lastCommitResult,
    pickCsvFile,
    downloadTemplate,
    onRowChange,
    onAcceptChange,
    runCommit,
    reset,
  } = useBulkImport<LaboratoryBulkRow>({
    requiredHeaders: LABORATORY_BULK_HEADERS,
    validateRow: validateLaboratoryRow,
    normalizeCell: normalizeLaboratoryCell,
    templateFileName: LABORATORY_CSV_TEMPLATE_FILENAME,
    getTemplateCsvContent: buildLaboratoryTemplateCsvContent,
    idPrefix: 'lab-bulk',
  });

  const handleDownloadTemplate = useCallback(async () => {
    const res = await downloadTemplate();
    if (!res.ok && res.message) {
      showMessage('Gagal Mengunduh Template', res.message);
    }
  }, [downloadTemplate]);

  const handlePickCsv = useCallback(async () => {
    await pickCsvFile();
  }, [pickCsvFile]);

  const handleConfirmImport = useCallback(
    async (acceptedValidRows: BulkImportDraftRow<LaboratoryBulkRow>[]) => {
      const cleanCourseId = selectedCourseId.trim();
      if (!cleanCourseId) {
        showMessage(
          'Mata Kuliah Belum Dipilih',
          'Pilih satu mata kuliah cakupan terlebih dahulu sebelum menyimpan data laboratorium.',
        );
        return;
      }

      if (!onCommitRows) {
        showMessage(
          'Menunggu Integrasi Rules',
          'Penyimpanan ke Firestore dinonaktifkan sementara menunggu role Aslab dan Security Rules (S4-H01/H02) aktif.',
        );
        return;
      }

      const result = await runCommit(async (readyRows) => {
        const allRowData = readyRows.map((item) => item.data);
        const validPayloads: ValidatedLaboratoryBulkPayload[] = [];
        const validDrafts: BulkImportDraftRow<LaboratoryBulkRow>[] = [];
        const rejectedOutcomes: BulkCommitItemOutcome[] = [];

        readyRows.forEach((draft, idx) => {
          const payload = toValidatedLaboratoryBulkPayload(
            cleanCourseId,
            draft.data,
            validateLaboratoryRow,
            idx,
            allRowData,
          );
          if (!payload) {
            rejectedOutcomes.push({
              localId: draft.localId,
              success: false,
              message: 'Data baris gagal melewati validasi akhir sebelum pengiriman.',
            });
          } else {
            validPayloads.push(payload);
            validDrafts.push(draft);
          }
        });

        if (validPayloads.length === 0) {
          return rejectedOutcomes;
        }

        const remoteOutcomes = await onCommitRows(
          cleanCourseId,
          validPayloads,
          validDrafts,
        );
        return [...rejectedOutcomes, ...remoteOutcomes];
      });

      if (result) {
        if (result.failedCount === 0) {
          showMessage(
            'Impor Berhasil',
            `${result.succeededCount} laboratorium berhasil disimpan untuk mata kuliah ${cleanCourseId}.`,
          );
        } else {
          showMessage(
            'Impor Selesai Sebagian',
            `${result.succeededCount} baris berhasil disimpan dan ${result.failedCount} baris gagal. Periksa pesan pada baris yang gagal lalu coba kembali.`,
          );
        }
      }
    },
    [onCommitRows, runCommit, selectedCourseId, validateLaboratoryRow],
  );

  const isCourseMissing = selectedCourseId.trim().length === 0;
  const isCommitAdapterMissing = !onCommitRows;

  const confirmDisabledReason = isCourseMissing
    ? 'Pilih mata kuliah terlebih dahulu sebelum menyimpan hasil impor.'
    : isCommitAdapterMissing
      ? 'Penyimpanan ke Firestore menunggu integrasi role Aslab & Security Rules (S4-H01/H02).'
      : null;

  const topControlCard = (
    <View style={styles.controlCard}>
      {/* Langkah 1: Pilih Mata Kuliah */}
      <View style={styles.stepSection}>
        <Text style={styles.sectionTitle}>1. Mata Kuliah Cakupan</Text>
        <Text style={styles.sectionHint}>
          Satu proses bulk import hanya berlaku untuk satu mata kuliah.
        </Text>

        {availableCourses.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.courseChipList}>
            {availableCourses.map((course) => {
              const active = selectedCourseId === course.id;
              return (
                <Pressable
                  key={course.id}
                  onPress={() => setSelectedCourseId(course.id)}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.courseChip,
                    active && styles.courseChipActive,
                  ]}>
                  <Text
                    style={[
                      styles.courseChipText,
                      active && styles.courseChipTextActive,
                    ]}>
                    {course.code ? `${course.code} · ${course.name}` : course.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.courseInputWrap}>
            <Text style={styles.inputLabel}>Kode / ID Mata Kuliah *</Text>
            <TextInput
              value={selectedCourseId}
              onChangeText={setSelectedCourseId}
              editable={!submitting}
              autoCapitalize="characters"
              placeholder="Contoh: IF301-PPK"
              placeholderTextColor={APP_COLORS.neutral400}
              style={styles.courseInput}
            />
          </View>
        )}
      </View>

      <View style={styles.divider} />

      {/* Langkah 2: Unduh Template & Pilih CSV */}
      <View style={styles.stepSection}>
        <Text style={styles.sectionTitle}>2. Template & File CSV</Text>
        <Text style={styles.sectionHint}>
          Kolom wajib: laboratoryCode, name, building, floor, latitude, longitude, radius, gracePeriodMinutes, fineAmount.
        </Text>

        <View style={styles.actionRow}>
          <CustomButton
            title="Unduh Template"
            variant="secondary"
            size="md"
            fullWidth={false}
            loading={downloadingTemplate}
            disabled={downloadingTemplate || submitting}
            leftIcon={
              !downloadingTemplate ? (
                <Ionicons
                  name="download-outline"
                  size={18}
                  color={APP_COLORS.tetsuKon}
                />
              ) : undefined
            }
            onPress={handleDownloadTemplate}
            style={styles.halfBtn}
          />

          <CustomButton
            title={rows.length > 0 ? 'Ganti File CSV' : 'Pilih File CSV'}
            variant="primary"
            size="md"
            fullWidth={false}
            loading={pickingFile}
            disabled={pickingFile || submitting}
            leftIcon={
              !pickingFile ? (
                <Ionicons
                  name="folder-open-outline"
                  size={18}
                  color={APP_COLORS.white}
                />
              ) : undefined
            }
            onPress={handlePickCsv}
            style={styles.halfBtn}
          />
        </View>

        {parseError ? (
          <View style={styles.errorBanner}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={APP_COLORS.dangerText}
            />
            <Text style={styles.errorBannerText}>{parseError}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <ResponsiveContainer>
      <AppHeader
        title="Import Laboratorium"
        subtitle="Bulk insert master lab & kebijakan presensi"
        onBack={() => navigation.goBack()}
      />

      <BulkImportPreview<LaboratoryBulkRow>
        rows={rows}
        columns={LABORATORY_BULK_COLUMNS}
        validateRow={validateLaboratoryRow}
        onRowChange={onRowChange}
        onAcceptChange={onAcceptChange}
        onConfirm={handleConfirmImport}
        summary={summary}
        lastCommitResult={lastCommitResult}
        submitting={submitting}
        confirmDisabled={isCourseMissing || isCommitAdapterMissing}
        confirmDisabledReason={confirmDisabledReason}
        entityLabel="Laboratorium"
        fileName={fileName}
        onReset={reset}
        listHeaderExtra={topControlCard}
        emptyTitle="Belum Ada Draft Laboratorium"
        emptyDescription="Unduh template_laboratorium.csv, lengkapi data laboratorium (maks. 200 baris), lalu pilih file CSV untuk meninjau hasil validasi."
        emptyActionTitle="Pilih File CSV"
        onEmptyActionPress={handlePickCsv}
      />
    </ResponsiveContainer>
  );
};

const styles = StyleSheet.create({
  controlCard: {
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    padding: APP_SPACING.lg,
    gap: APP_SPACING.md,
  },
  stepSection: {
    gap: APP_SPACING.xs,
  },
  sectionTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 15,
    color: APP_COLORS.inkPrimary,
  },
  sectionHint: {
    fontFamily: APP_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: APP_COLORS.textSecondary,
  },
  courseChipList: {
    flexDirection: 'row',
    gap: APP_SPACING.sm,
    paddingTop: APP_SPACING.xs,
  },
  courseChip: {
    minHeight: 40,
    paddingHorizontal: APP_SPACING.md,
    paddingVertical: APP_SPACING.sm,
    borderRadius: APP_RADIUS.md,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    backgroundColor: APP_COLORS.surfaceSubtle,
    justifyContent: 'center',
  },
  courseChipActive: {
    backgroundColor: APP_COLORS.primary,
    borderColor: APP_COLORS.primary,
  },
  courseChipText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 13,
    color: APP_COLORS.inkPrimary,
  },
  courseChipTextActive: {
    color: APP_COLORS.white,
  },
  courseInputWrap: {
    marginTop: APP_SPACING.xs,
    gap: 4,
  },
  inputLabel: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.inkPrimary,
  },
  courseInput: {
    minHeight: 46,
    borderRadius: APP_RADIUS.md,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    backgroundColor: APP_COLORS.white,
    paddingHorizontal: APP_SPACING.md,
    fontFamily: APP_FONTS.medium,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: APP_COLORS.divider,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: APP_SPACING.sm,
    marginTop: APP_SPACING.xs,
  },
  halfBtn: {
    flex: 1,
    minWidth: 145,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: APP_SPACING.sm,
    marginTop: APP_SPACING.xs,
    padding: APP_SPACING.md,
    borderRadius: APP_RADIUS.md,
    backgroundColor: APP_COLORS.errorSoft,
    borderWidth: 1,
    borderColor: APP_COLORS.danger,
  },
  errorBannerText: {
    flex: 1,
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
    color: APP_COLORS.dangerText,
  },
});

export default LaboratoryImportScreen;
