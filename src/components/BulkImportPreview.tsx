/**
 * Yuma — Reusable Controlled Component `BulkImportPreview<Row>` (Sprint 4 — S4-Y02)
 *
 * Komponen preview, validasi per baris, edit modal, dan seleksi Terima/Tolak yang generik
 * untuk tiga menu bulk import terpisah:
 * 1. Master Laboratorium (Yuma)
 * 2. Anggota Praktikan (Sela)
 * 3. Anggota Asprak (Sela)
 *
 * Prinsip batas tanggung jawab:
 * - Murni presentational & controlled: TIDAK menulis langsung ke Firestore dan TIDAK memeriksa role/otorisasi.
 * - Menerima `rows`, `columns`, `validateRow`, `onRowChange`, `onAcceptChange`, dan `onConfirm` dari layar pemanggil.
 * - Menggunakan `FlatList` ter-virtualisasi, modal edit per baris dengan highlight error langsung,
 *   serta `ConfirmModal` sebelum memanggil `onConfirm`.
 */
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  BulkCommitBatchResult,
  BulkImportColumn,
  BulkImportDraftRow,
  BulkImportSummary,
  BulkRowValidator,
} from '@/types/bulkImport';
import {
  getReadyToCommitDraftRows,
  summarizeDraftRows,
} from '@/services/bulkImportCore';
import { ConfirmModal } from './ConfirmModal';
import { CustomButton } from './CustomButton';
import { EmptyState } from './EmptyState';
import { StatusBadge } from './StatusBadge';
import {
  APP_COLORS,
  APP_FONTS,
  APP_RADIUS,
  APP_SHADOWS,
  APP_SPACING,
} from '@/constants/theme';

type PreviewFilterKey = 'all' | 'ready' | 'invalid' | 'denied' | 'failed';

export interface BulkImportPreviewProps<Row extends Record<string, string>> {
  /** Daftar baris draft hasil parsing CSV. */
  rows: readonly BulkImportDraftRow<Row>[];
  /** Skema kolom untuk tampilan kartu preview & form edit per baris. */
  columns: readonly BulkImportColumn<Row>[];
  /** Fungsi validator baris milik modul pemanggil. */
  validateRow: BulkRowValidator<Row>;
  /** Dipanggil ketika pengguna menyimpan perubahan field dari modal edit satu baris. */
  onRowChange: (localId: string, updatedFields: Partial<Row>) => void;
  /** Dipanggil ketika pengguna menekan tombol Terima / Tolak pada satu baris. */
  onAcceptChange: (localId: string, accepted: boolean) => void;
  /** Dipanggil setelah pengguna menyetujui dialog konfirmasi akhir; hanya menerima baris accepted + valid. */
  onConfirm: (
    acceptedValidRows: BulkImportDraftRow<Row>[],
  ) => void | Promise<void>;
  /** Ringkasan jumlah baris (opsional; dihitung otomatis dari `rows` bila tidak diberikan). */
  summary?: BulkImportSummary;
  /** Hasil batch commit terakhir untuk menampilkan laporan sukses/gagal sebagian secara transparan. */
  lastCommitResult?: BulkCommitBatchResult | null;
  /** Status loading selama proses penyimpanan ke backend/Firestore berlangsung. */
  submitting?: boolean;
  /** Menonaktifkan tombol konfirmasi akhir (mis. bila mata kuliah belum dipilih). */
  confirmDisabled?: boolean;
  /** Pesan alasan mengapa tombol konfirmasi dinonaktifkan (opsional). */
  confirmDisabledReason?: string | null;
  /** Nama entitas untuk label tombol & konfirmasi (contoh: `"Laboratorium"`, `"Praktikan"`, `"Asprak"`). */
  entityLabel?: string;
  /** Nama file CSV yang sedang dimuat (opsional). */
  fileName?: string | null;
  /** Aksi mereset / menghapus file draft saat ini (opsional). */
  onReset?: () => void;
  /** Konten tambahan di bagian atas `FlatList` (mis. pemilih mata kuliah & tombol unduh/pilih CSV). */
  listHeaderExtra?: React.ReactNode;
  /** Judul empty state ketika belum ada baris yang dimuat. */
  emptyTitle?: string;
  /** Deskripsi empty state ketika belum ada baris yang dimuat. */
  emptyDescription?: string;
  /** Label tombol aksi pada empty state (mis. `"Pilih File CSV"`). */
  emptyActionTitle?: string;
  /** Handler tombol aksi pada empty state. */
  onEmptyActionPress?: () => void;
}

export function BulkImportPreview<Row extends Record<string, string>>({
  rows,
  columns,
  validateRow,
  onRowChange,
  onAcceptChange,
  onConfirm,
  summary: externalSummary,
  lastCommitResult,
  submitting = false,
  confirmDisabled = false,
  confirmDisabledReason,
  entityLabel = 'Data',
  fileName,
  onReset,
  listHeaderExtra,
  emptyTitle = 'Belum Ada File CSV Dimuat',
  emptyDescription = 'Unduh template CSV terlebih dahulu, isi data sesuai kolom, lalu pilih file CSV untuk meninjau baris sebelum disimpan.',
  emptyActionTitle,
  onEmptyActionPress,
}: BulkImportPreviewProps<Row>): React.ReactElement {
  const computedSummary = useMemo(
    () => externalSummary ?? summarizeDraftRows(rows),
    [externalSummary, rows],
  );

  const [activeFilter, setActiveFilter] = useState<PreviewFilterKey>('all');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);

  const editingTarget = useMemo(
    () => rows.find((item) => item.localId === editingRowId) ?? null,
    [editingRowId, rows],
  );

  const editingTargetIndex = useMemo(
    () => rows.findIndex((item) => item.localId === editingRowId),
    [editingRowId, rows],
  );

  // Validasi real-time di dalam modal edit agar Aslab langsung melihat kolom mana yang kosong/salah
  const liveModalValidation = useMemo(() => {
    if (!editingTarget || editingTargetIndex < 0) return null;
    const simulatedAllRows = rows.map((item, idx) =>
      idx === editingTargetIndex ? (editDraft as Row) : item.data,
    );
    return validateRow(editDraft as Row, editingTargetIndex, simulatedAllRows);
  }, [editDraft, editingTarget, editingTargetIndex, rows, validateRow]);

  const filteredRows = useMemo(() => {
    switch (activeFilter) {
      case 'ready':
        return rows.filter(
          (r) =>
            r.commitState !== 'committed' && r.accepted && r.validation.valid,
        );
      case 'invalid':
        return rows.filter(
          (r) => r.commitState !== 'committed' && !r.validation.valid,
        );
      case 'denied':
        return rows.filter(
          (r) => r.commitState !== 'committed' && r.manuallyDenied,
        );
      case 'failed':
        return rows.filter((r) => r.commitState === 'failed');
      case 'all':
      default:
        return rows;
    }
  }, [activeFilter, rows]);

  const readyRows = useMemo(() => getReadyToCommitDraftRows(rows), [rows]);

  const openEditModal = (row: BulkImportDraftRow<Row>) => {
    if (submitting || row.commitState === 'committed') return;
    const copy: Record<string, string> = {};
    for (const col of columns) {
      copy[col.key] = String(row.data[col.key] ?? '');
    }
    setEditDraft(copy);
    setEditingRowId(row.localId);
  };

  const closeEditModal = () => {
    setEditingRowId(null);
    setEditDraft({});
  };

  const handleSaveRowEdit = () => {
    if (!editingTarget) return;
    const patch: Partial<Row> = {};
    for (const col of columns) {
      const rawVal = editDraft[col.key] ?? '';
      patch[col.key] = (
        col.inputType === 'code' ? rawVal.trim().toUpperCase() : rawVal.trim()
      ) as Row[keyof Row & string];
    }
    onRowChange(editingTarget.localId, patch);
    closeEditModal();
  };

  const handleExecuteConfirm = async () => {
    setConfirmModalVisible(false);
    if (readyRows.length === 0 || submitting || confirmDisabled) return;
    await onConfirm(readyRows);
  };

  const primaryColumn = columns[0];
  const secondaryColumn = columns[1];
  const detailColumns = columns.slice(2);

  const filterChips: {
    key: PreviewFilterKey;
    label: string;
    count: number;
    hidden?: boolean;
  }[] = [
    { key: 'all', label: 'Semua', count: computedSummary.totalRows },
    {
      key: 'ready',
      label: 'Siap Simpan',
      count: computedSummary.readyToCommitRows,
    },
    {
      key: 'invalid',
      label: 'Perlu Perbaikan',
      count: computedSummary.invalidRows,
    },
    { key: 'denied', label: 'Ditolak', count: computedSummary.deniedRows },
    {
      key: 'failed',
      label: 'Gagal Simpan',
      count: computedSummary.failedCommitRows,
      hidden: computedSummary.failedCommitRows === 0,
    },
  ];

  const renderRowItem = ({ item }: { item: BulkImportDraftRow<Row> }) => {
    const isCommitted = item.commitState === 'committed';
    const isFailedCommit = item.commitState === 'failed';
    const isValid = item.validation.valid;

    const primaryText = primaryColumn
      ? String(item.data[primaryColumn.key] ?? '').trim()
      : '';
    const secondaryText = secondaryColumn
      ? String(item.data[secondaryColumn.key] ?? '').trim()
      : '';

    let badgeStatus = 'INFO';
    let badgeLabel = 'VALID';
    if (isCommitted) {
      badgeStatus = 'DITERIMA';
      badgeLabel = 'TERSIMPAN';
    } else if (isFailedCommit) {
      badgeStatus = 'ERROR';
      badgeLabel = 'GAGAL SIMPAN';
    } else if (!isValid) {
      badgeStatus = 'ERROR';
      badgeLabel = 'PERLU PERBAIKAN';
    } else if (item.manuallyDenied || !item.accepted) {
      badgeStatus = 'SELESAI';
      badgeLabel = 'DITOLAK';
    } else {
      badgeStatus = 'DITERIMA';
      badgeLabel = 'DITERIMA';
    }

    return (
      <View
        style={[
          styles.rowCard,
          (!isValid || isFailedCommit) && styles.rowCardInvalid,
          isCommitted && styles.rowCardCommitted,
          item.manuallyDenied && !isCommitted && styles.rowCardDenied,
        ]}>
        <View style={styles.rowHeader}>
          <View style={styles.rowTitleWrap}>
            <Text style={styles.rowIndexLabel}>Baris #{item.rowNumber}</Text>
            <Text style={styles.rowPrimaryTitle} numberOfLines={2}>
              {primaryText && secondaryText
                ? `${primaryText} · ${secondaryText}`
                : primaryText || secondaryText || 'Data baris belum lengkap'}
            </Text>
          </View>
          <StatusBadge status={badgeStatus} label={badgeLabel} size="sm" />
        </View>

        {/* Ringkasan nilai kolom */}
        <View style={styles.fieldsContainer}>
          {columns.map((col) => {
            // Hindari mengulang 2 kolom utama bila sudah valid dan tampil penuh di judul,
            // kecuali kolom tersebut kosong atau memiliki error.
            const rawVal = String(item.data[col.key] ?? '').trim();
            const fieldErr = item.validation.fieldErrors[col.key];
            const isHeaderCol =
              col.key === primaryColumn?.key || col.key === secondaryColumn?.key;

            if (isHeaderCol && rawVal && !fieldErr && detailColumns.length > 0) {
              return null;
            }

            const formatted = col.formatPreview
              ? col.formatPreview(rawVal, item.data)
              : rawVal || 'Kosong';

            return (
              <View key={col.key} style={styles.fieldLine}>
                <Text style={styles.fieldLineLabel}>{col.label}</Text>
                <Text
                  style={[
                    styles.fieldLineValue,
                    (!rawVal || Boolean(fieldErr)) && styles.fieldLineValueError,
                  ]}
                  numberOfLines={1}>
                  {rawVal ? formatted : 'Kosong'}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Pesan validasi per baris */}
        {!isCommitted && item.validation.messages.length > 0 && (
          <View style={styles.messageBoxError}>
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={APP_COLORS.dangerText}
            />
            <View style={styles.messageTextList}>
              {item.validation.messages.map((msg, idx) => (
                <Text key={`${item.localId}-err-${idx}`} style={styles.messageErrorText}>
                  {msg}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Pesan hasil commit per baris (gagal / sukses) */}
        {item.commitMessage && (
          <View
            style={
              isCommitted ? styles.messageBoxSuccess : styles.messageBoxError
            }>
            <Ionicons
              name={
                isCommitted
                  ? 'checkmark-circle-outline'
                  : 'warning-outline'
              }
              size={16}
              color={isCommitted ? APP_COLORS.opened : APP_COLORS.dangerText}
            />
            <Text
              style={
                isCommitted
                  ? styles.messageSuccessText
                  : styles.messageErrorText
              }>
              {item.commitMessage}
            </Text>
          </View>
        )}

        {/* Baris aksi: Edit + Toggle Terima / Tolak */}
        {!isCommitted ? (
          <View style={styles.rowActionsFooter}>
            <Pressable
              onPress={() => openEditModal(item)}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel={`Edit baris ${item.rowNumber}`}
              style={({ pressed }) => [
                styles.editRowBtn,
                pressed && styles.pressed,
                submitting && styles.disabledBtn,
              ]}>
              <Ionicons
                name="create-outline"
                size={16}
                color={APP_COLORS.inkPrimary}
              />
              <Text style={styles.editRowBtnText}>
                {isValid ? 'Edit' : 'Lengkapi / Edit'}
              </Text>
            </Pressable>

            <View style={styles.decisionGroup}>
              <Pressable
                onPress={() => onAcceptChange(item.localId, true)}
                disabled={!isValid || submitting}
                accessibilityRole="button"
                accessibilityState={{
                  selected: item.accepted && isValid,
                  disabled: !isValid || submitting,
                }}
                accessibilityLabel={`Terima baris ${item.rowNumber}`}
                style={({ pressed }) => [
                  styles.decisionBtn,
                  item.accepted && isValid && styles.decisionBtnAcceptActive,
                  (!isValid || submitting) && styles.decisionBtnDisabled,
                  pressed && isValid && !submitting && styles.pressed,
                ]}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={16}
                  color={
                    item.accepted && isValid
                      ? APP_COLORS.opened
                      : !isValid
                        ? APP_COLORS.neutral400
                        : APP_COLORS.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.decisionBtnText,
                    item.accepted &&
                      isValid &&
                      styles.decisionBtnAcceptTextActive,
                    !isValid && styles.decisionBtnTextDisabled,
                  ]}>
                  Terima
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onAcceptChange(item.localId, false)}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityState={{
                  selected: item.manuallyDenied,
                  disabled: submitting,
                }}
                accessibilityLabel={`Tolak baris ${item.rowNumber}`}
                style={({ pressed }) => [
                  styles.decisionBtn,
                  item.manuallyDenied && styles.decisionBtnDenyActive,
                  submitting && styles.decisionBtnDisabled,
                  pressed && !submitting && styles.pressed,
                ]}>
                <Ionicons
                  name="close-circle-outline"
                  size={16}
                  color={
                    item.manuallyDenied
                      ? APP_COLORS.dangerText
                      : APP_COLORS.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.decisionBtnText,
                    item.manuallyDenied && styles.decisionBtnDenyTextActive,
                  ]}>
                  Tolak
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const canConfirm =
    readyRows.length > 0 && !submitting && !confirmDisabled;

  return (
    <View style={styles.wrapper}>
      <FlatList
        data={filteredRows}
        keyExtractor={(item) => item.localId}
        renderItem={renderRowItem}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            {listHeaderExtra}

            {rows.length > 0 && (
              <View style={styles.summaryPanel}>
                <View style={styles.summaryHeaderRow}>
                  <View style={styles.fileInfoWrap}>
                    <Ionicons
                      name="document-text-outline"
                      size={18}
                      color={APP_COLORS.primary}
                    />
                    <View style={styles.fileTextCol}>
                      <Text style={styles.summaryTitle} numberOfLines={1}>
                        {fileName || 'Draft Impor CSV'}
                      </Text>
                      <Text style={styles.summarySubtitle}>
                        {computedSummary.totalRows} baris ·{' '}
                        {computedSummary.validRows} valid ·{' '}
                        {computedSummary.invalidRows} perlu perbaikan ·{' '}
                        {computedSummary.deniedRows} ditolak
                      </Text>
                    </View>
                  </View>

                  {onReset && !submitting && (
                    <Pressable
                      onPress={onReset}
                      accessibilityRole="button"
                      accessibilityLabel="Hapus draft CSV"
                      style={({ pressed }) => [
                        styles.clearDraftBtn,
                        pressed && styles.pressed,
                      ]}>
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color={APP_COLORS.dangerText}
                      />
                      <Text style={styles.clearDraftText}>Reset</Text>
                    </Pressable>
                  )}
                </View>

                {/* Laporan hasil commit batch (transparan untuk sukses penuh vs gagal sebagian) */}
                {lastCommitResult && (
                  <View
                    style={[
                      styles.batchReportBanner,
                      lastCommitResult.failedCount > 0
                        ? styles.batchReportWarning
                        : styles.batchReportSuccess,
                    ]}>
                    <Ionicons
                      name={
                        lastCommitResult.failedCount > 0
                          ? 'alert-circle'
                          : 'checkmark-circle'
                      }
                      size={18}
                      color={
                        lastCommitResult.failedCount > 0
                          ? APP_COLORS.warning
                          : APP_COLORS.opened
                      }
                    />
                    <Text
                      style={[
                        styles.batchReportText,
                        lastCommitResult.failedCount > 0
                          ? styles.batchReportTextWarning
                          : styles.batchReportTextSuccess,
                      ]}>
                      {lastCommitResult.failedCount > 0
                        ? `Sebagian baris gagal disimpan: ${lastCommitResult.succeededCount} berhasil, ${lastCommitResult.failedCount} gagal. Perbaiki baris yang gagal lalu kirim ulang.`
                        : `Seluruh ${lastCommitResult.succeededCount} baris ${entityLabel.toLowerCase()} yang dipilih berhasil disimpan.`}
                    </Text>
                  </View>
                )}

                {/* Filter chips berhitung */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterChipsRow}>
                  {filterChips
                    .filter((chip) => !chip.hidden)
                    .map((chip) => {
                      const selected = activeFilter === chip.key;
                      return (
                        <Pressable
                          key={chip.key}
                          onPress={() => setActiveFilter(chip.key)}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          style={[
                            styles.filterChip,
                            selected && styles.filterChipActive,
                          ]}>
                          <Text
                            style={[
                              styles.filterChipText,
                              selected && styles.filterChipTextActive,
                            ]}>
                            {chip.label} ({chip.count})
                          </Text>
                        </Pressable>
                      );
                    })}
                </ScrollView>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          rows.length === 0 ? (
            <EmptyState
              icon="cloud-upload-outline"
              title={emptyTitle}
              description={emptyDescription}
              actionTitle={emptyActionTitle}
              onActionPress={onEmptyActionPress}
            />
          ) : (
            <EmptyState
              icon="filter-outline"
              title="Tidak Ada Baris pada Filter Ini"
              description="Ubah filter di atas ke 'Semua' untuk melihat seluruh baris CSV."
              actionTitle="Tampilkan Semua"
              onActionPress={() => setActiveFilter('all')}
            />
          )
        }
      />

      {/* Footer sticky konfirmasi simpan hanya muncul bila ada baris CSV */}
      {rows.length > 0 && (
        <View style={styles.stickyFooter}>
          {confirmDisabled && confirmDisabledReason ? (
            <Text style={styles.disabledHintText}>{confirmDisabledReason}</Text>
          ) : computedSummary.readyToCommitRows === 0 &&
            computedSummary.committedRows < computedSummary.totalRows ? (
            <Text style={styles.disabledHintText}>
              Perbaiki baris yang bermasalah atau terima minimal satu baris valid untuk menyimpan.
            </Text>
          ) : null}

          <CustomButton
            title={
              submitting
                ? `Menyimpan ${entityLabel}...`
                : `Simpan ${computedSummary.readyToCommitRows} ${entityLabel} Valid`
            }
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={!canConfirm}
            leftIcon={
              !submitting ? (
                <Ionicons
                  name="cloud-done-outline"
                  size={18}
                  color={
                    canConfirm ? APP_COLORS.white : APP_COLORS.textMuted
                  }
                />
              ) : undefined
            }
            onPress={() => setConfirmModalVisible(true)}
          />
        </View>
      )}

      {/* Modal Edit per Baris */}
      <Modal
        visible={Boolean(editingTarget)}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={closeEditModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleCol}>
                <Text style={styles.modalTitle}>
                  Edit Baris #{editingTarget?.rowNumber ?? ''}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Kolom bertanda merah wajib dilengkapi atau diperbaiki.
                </Text>
              </View>
              <Pressable
                onPress={closeEditModal}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Tutup modal edit"
                style={styles.closeCircleBtn}>
                <Ionicons
                  name="close"
                  size={20}
                  color={APP_COLORS.inkPrimary}
                />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}>
              {columns.map((col) => {
                const currentVal = editDraft[col.key] ?? '';
                const fieldErr = liveModalValidation?.fieldErrors[col.key];
                const isRequired = col.required !== false;

                let keyboardType:
                  | 'default'
                  | 'numeric'
                  | 'numbers-and-punctuation'
                  | 'email-address' = 'default';
                let autoCapitalize: 'none' | 'words' | 'characters' = 'words';

                if (col.inputType === 'number') {
                  keyboardType = 'numeric';
                  autoCapitalize = 'none';
                } else if (col.inputType === 'decimal') {
                  keyboardType = 'numbers-and-punctuation';
                  autoCapitalize = 'none';
                } else if (col.inputType === 'email') {
                  keyboardType = 'email-address';
                  autoCapitalize = 'none';
                } else if (col.inputType === 'code') {
                  autoCapitalize = 'characters';
                }

                return (
                  <View key={col.key} style={styles.modalFieldGroup}>
                    <Text style={styles.modalFieldLabel}>
                      {col.label}
                      {isRequired ? ' *' : ''}
                    </Text>
                    <TextInput
                      value={currentVal}
                      onChangeText={(nextText) =>
                        setEditDraft((prev) => ({
                          ...prev,
                          [col.key]:
                            col.inputType === 'code'
                              ? nextText.toUpperCase()
                              : nextText,
                        }))
                      }
                      placeholder={col.placeholder ?? `Isi ${col.label.toLowerCase()}`}
                      placeholderTextColor={APP_COLORS.neutral400}
                      keyboardType={keyboardType}
                      autoCapitalize={autoCapitalize}
                      style={[
                        styles.modalInput,
                        Boolean(fieldErr) && styles.modalInputError,
                      ]}
                    />
                    {fieldErr ? (
                      <Text style={styles.modalFieldErrorText}>{fieldErr}</Text>
                    ) : col.helperText ? (
                      <Text style={styles.modalFieldHelperText}>
                        {col.helperText}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooterActions}>
              <CustomButton
                title="Batal"
                variant="outline"
                size="md"
                fullWidth={false}
                onPress={closeEditModal}
                style={styles.modalFooterBtn}
              />
              <CustomButton
                title={
                  liveModalValidation?.valid
                    ? 'Simpan & Terima Baris'
                    : 'Simpan Draft Baris'
                }
                variant="primary"
                size="md"
                fullWidth={false}
                onPress={handleSaveRowEdit}
                style={styles.modalFooterBtnPrimary}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Dialog Konfirmasi Akhir Sebelum Commit */}
      <ConfirmModal
        visible={confirmModalVisible}
        title={`Konfirmasi Impor ${entityLabel}`}
        subtitle={`Hanya ${computedSummary.readyToCommitRows} baris yang berstatus Diterima & Valid yang akan disimpan.${
          computedSummary.invalidRows + computedSummary.deniedRows > 0
            ? ` Sebanyak ${computedSummary.invalidRows + computedSummary.deniedRows} baris lainnya (perlu perbaikan / ditolak) tidak akan dikirim.`
            : ''
        }`}
        confirmText={`Ya, Simpan (${computedSummary.readyToCommitRows})`}
        cancelText="Periksa Lagi"
        confirmVariant="primary"
        loading={submitting}
        onConfirm={handleExecuteConfirm}
        onCancel={() => {
          if (!submitting) setConfirmModalVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: APP_SPACING.lg,
    paddingTop: APP_SPACING.xs,
    paddingBottom: APP_SPACING.xxl,
    gap: APP_SPACING.md,
  },
  headerBlock: {
    gap: APP_SPACING.md,
    marginBottom: APP_SPACING.xs,
  },
  summaryPanel: {
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    padding: APP_SPACING.lg,
    gap: APP_SPACING.md,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: APP_SPACING.sm,
  },
  fileInfoWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_SPACING.sm,
  },
  fileTextCol: {
    flex: 1,
  },
  summaryTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
  },
  summarySubtitle: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
  },
  clearDraftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 38,
    paddingHorizontal: APP_SPACING.sm,
    borderRadius: APP_RADIUS.sm,
    backgroundColor: APP_COLORS.errorSoft,
  },
  clearDraftText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.dangerText,
  },
  batchReportBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: APP_SPACING.sm,
    padding: APP_SPACING.md,
    borderRadius: APP_RADIUS.md,
    borderWidth: 1,
  },
  batchReportSuccess: {
    backgroundColor: APP_COLORS.openedSoft,
    borderColor: APP_COLORS.opened,
  },
  batchReportWarning: {
    backgroundColor: APP_COLORS.warningBg,
    borderColor: APP_COLORS.warning,
  },
  batchReportText: {
    flex: 1,
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
  },
  batchReportTextSuccess: {
    color: APP_COLORS.opened,
  },
  batchReportTextWarning: {
    color: APP_COLORS.warning,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: APP_SPACING.sm,
    paddingVertical: 2,
  },
  filterChip: {
    minHeight: 36,
    paddingHorizontal: APP_SPACING.md,
    paddingVertical: 6,
    borderRadius: APP_RADIUS.pill,
    backgroundColor: APP_COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: APP_COLORS.primary,
    borderColor: APP_COLORS.primary,
  },
  filterChipText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: APP_COLORS.white,
  },
  rowCard: {
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    padding: APP_SPACING.lg,
    gap: APP_SPACING.sm,
  },
  rowCardInvalid: {
    borderColor: APP_COLORS.danger,
  },
  rowCardCommitted: {
    backgroundColor: APP_COLORS.neutral50,
    borderColor: APP_COLORS.opened,
  },
  rowCardDenied: {
    opacity: 0.82,
    backgroundColor: APP_COLORS.neutral50,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: APP_SPACING.sm,
  },
  rowTitleWrap: {
    flex: 1,
  },
  rowIndexLabel: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 11,
    color: APP_COLORS.textSecondary,
    marginBottom: 2,
  },
  rowPrimaryTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 15,
    lineHeight: 21,
    color: APP_COLORS.inkPrimary,
  },
  fieldsContainer: {
    borderTopWidth: 1,
    borderTopColor: APP_COLORS.divider,
    paddingTop: APP_SPACING.sm,
    gap: 4,
  },
  fieldLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: APP_SPACING.sm,
  },
  fieldLineLabel: {
    fontFamily: APP_FONTS.regular,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  fieldLineValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: APP_COLORS.inkPrimary,
  },
  fieldLineValueError: {
    color: APP_COLORS.dangerText,
    fontFamily: APP_FONTS.semiBold,
  },
  messageBoxError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: APP_SPACING.xs,
    backgroundColor: APP_COLORS.errorSoft,
    padding: APP_SPACING.sm,
    borderRadius: APP_RADIUS.sm,
  },
  messageBoxSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_SPACING.xs,
    backgroundColor: APP_COLORS.openedSoft,
    padding: APP_SPACING.sm,
    borderRadius: APP_RADIUS.sm,
  },
  messageTextList: {
    flex: 1,
    gap: 2,
  },
  messageErrorText: {
    flex: 1,
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    lineHeight: 17,
    color: APP_COLORS.dangerText,
  },
  messageSuccessText: {
    flex: 1,
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    lineHeight: 17,
    color: APP_COLORS.opened,
  },
  rowActionsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: APP_SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: APP_COLORS.divider,
    paddingTop: APP_SPACING.sm,
    marginTop: 2,
  },
  editRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: APP_SPACING.md,
    borderRadius: APP_RADIUS.md,
    backgroundColor: APP_COLORS.nordicBreeze,
  },
  editRowBtnText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 13,
    color: APP_COLORS.inkPrimary,
  },
  decisionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_SPACING.sm,
  },
  decisionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: APP_SPACING.md,
    borderRadius: APP_RADIUS.md,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    backgroundColor: APP_COLORS.white,
  },
  decisionBtnAcceptActive: {
    backgroundColor: APP_COLORS.openedSoft,
    borderColor: APP_COLORS.opened,
  },
  decisionBtnDenyActive: {
    backgroundColor: APP_COLORS.errorSoft,
    borderColor: APP_COLORS.danger,
  },
  decisionBtnDisabled: {
    backgroundColor: APP_COLORS.neutral100,
    borderColor: APP_COLORS.border,
    opacity: 0.65,
  },
  decisionBtnText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  decisionBtnAcceptTextActive: {
    color: APP_COLORS.opened,
  },
  decisionBtnDenyTextActive: {
    color: APP_COLORS.dangerText,
  },
  decisionBtnTextDisabled: {
    color: APP_COLORS.neutral400,
  },
  stickyFooter: {
    backgroundColor: APP_COLORS.white,
    borderTopWidth: 1,
    borderTopColor: APP_COLORS.border,
    paddingHorizontal: APP_SPACING.lg,
    paddingTop: APP_SPACING.md,
    paddingBottom: Platform.OS === 'ios' ? APP_SPACING.lg : APP_SPACING.md,
    gap: APP_SPACING.xs,
  },
  disabledHintText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  pressed: {
    opacity: 0.78,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 24, 75, 0.48)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: APP_COLORS.white,
    borderTopLeftRadius: APP_RADIUS.modal,
    borderTopRightRadius: APP_RADIUS.modal,
    paddingHorizontal: APP_SPACING.lg,
    paddingTop: APP_SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? APP_SPACING.xxl : APP_SPACING.lg,
    maxHeight: '88%',
    ...APP_SHADOWS.modal,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: APP_SPACING.md,
    marginBottom: APP_SPACING.md,
  },
  modalTitleCol: {
    flex: 1,
  },
  modalTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 18,
    color: APP_COLORS.inkPrimary,
  },
  modalSubtitle: {
    fontFamily: APP_FONTS.regular,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
  },
  closeCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: APP_COLORS.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollContent: {
    paddingBottom: APP_SPACING.md,
    gap: APP_SPACING.md,
  },
  modalFieldGroup: {
    gap: 5,
  },
  modalFieldLabel: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 13,
    color: APP_COLORS.inkPrimary,
  },
  modalInput: {
    minHeight: 46,
    borderRadius: APP_RADIUS.md,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    backgroundColor: APP_COLORS.white,
    paddingHorizontal: APP_SPACING.md,
    paddingVertical: 10,
    fontFamily: APP_FONTS.regular,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
  },
  modalInputError: {
    borderWidth: 1.5,
    borderColor: APP_COLORS.danger,
    backgroundColor: '#FFFBFB',
  },
  modalFieldErrorText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.dangerText,
  },
  modalFieldHelperText: {
    fontFamily: APP_FONTS.regular,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  modalFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: APP_SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: APP_COLORS.divider,
    paddingTop: APP_SPACING.md,
    marginTop: APP_SPACING.xs,
  },
  modalFooterBtn: {
    minWidth: 96,
  },
  modalFooterBtnPrimary: {
    flex: 1,
  },
});

export default BulkImportPreview;
