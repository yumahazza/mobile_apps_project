/**
 * Yuma — LaboratoryManagementScreen (Sprint 3)
 * Pengelolaan data lokasi laboratorium, koordinat GPS, dan radius presensi khusus role Asisten.
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { useLaboratories } from '@/hooks/useLaboratories';
import { useFirestoreSchedules } from '@/hooks/useFirestoreSchedules';
import { useDeviceLocation } from '@/hooks/useDeviceLocation';
import {
  createLaboratory,
  DEFAULT_LABORATORY_RADIUS_METERS,
  deleteLaboratory,
  findSchedulesReferencingLaboratory,
  parseCoordinateInput,
  parseRadiusInput,
  updateLaboratory,
  validateLaboratoryInput,
} from '@/services/laboratoryService';
import type { Laboratory } from '@/types/laboratory';
import { AppHeader } from '@/components/AppHeader';
import { BottomNavigation } from '@/components/BottomNavigation';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CustomButton } from '@/components/CustomButton';
import { EmptyState } from '@/components/EmptyState';
import type { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
  APP_FONTS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

interface LaboratoryManagementScreenProps {
  navigation: NavigationProp;
}

interface LaboratoryFormState {
  name: string;
  building: string;
  floor: string;
  latitude: string;
  longitude: string;
  radius: string;
}

const RADIUS_PRESETS = [25, 50, 100, 150];

const createEmptyForm = (): LaboratoryFormState => ({
  name: '',
  building: '',
  floor: '',
  latitude: '',
  longitude: '',
  radius: String(DEFAULT_LABORATORY_RADIUS_METERS),
});

export const LaboratoryManagementScreen: React.FC<
  LaboratoryManagementScreenProps
> = ({ navigation }) => {
  const { activeUser, activeRole } = useApp();
  const isAssistant = activeRole === 'assistant';
  const activeNavTab =
    navigation.params?.fromTab === 'Profile' ? 'Profile' : 'ScheduleList';

  const { laboratories, loading, error } = useLaboratories(
    isAssistant ? activeUser.id : undefined,
  );
  const { schedules } = useFirestoreSchedules(
    activeUser.id,
    isAssistant ? 'assistant' : activeRole,
  );
  const {
    loading: fetchingGps,
    error: gpsError,
    fetchLocation,
    clearError: clearGpsError,
    openSettings,
  } = useDeviceLocation();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingLab, setEditingLab] = useState<Laboratory | null>(null);
  const [form, setForm] = useState<LaboratoryFormState>(createEmptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Laboratory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const deleteUsageSummary = useMemo(() => {
    if (!deleteTarget) {
      return { openSchedules: [], otherSchedules: [] };
    }
    return findSchedulesReferencingLaboratory(deleteTarget, schedules);
  }, [deleteTarget, schedules]);

  if (!isAssistant) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <AppHeader
          title="Lokasi Laboratorium"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.restrictedWrapper}>
          <EmptyState
            icon="lock-closed-outline"
            title="Akses Terbatas"
            description="Pengelolaan data lokasi laboratorium hanya tersedia untuk role Asisten Praktikum."
            actionTitle="Kembali"
            onActionPress={() => navigation.goBack()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const updateField = (field: keyof LaboratoryFormState, value: string) => {
    setFormError(null);
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const openCreateModal = () => {
    setEditingLab(null);
    setForm(createEmptyForm());
    setFormError(null);
    setGpsAccuracy(null);
    clearGpsError();
    setModalVisible(true);
  };

  const openEditModal = (lab: Laboratory) => {
    setEditingLab(lab);
    setForm({
      name: lab.name,
      building: lab.building,
      floor: lab.floor,
      latitude: String(lab.latitude),
      longitude: String(lab.longitude),
      radius: String(lab.radius),
    });
    setFormError(null);
    setGpsAccuracy(null);
    clearGpsError();
    setModalVisible(true);
  };

  const handleUseCurrentLocation = async () => {
    setFormError(null);
    const coords = await fetchLocation({
      allowLastKnownFallback: true,
      promptEnableServices: true,
      timeoutMs: 12_000,
    });

    if (coords) {
      setForm((prev) => ({
        ...prev,
        latitude: coords.latitude.toFixed(6),
        longitude: coords.longitude.toFixed(6),
      }));
      setGpsAccuracy(coords.accuracy);
    }
  };

  const handleSave = async () => {
    if (saving) return;

    const parsedLat = parseCoordinateInput(form.latitude);
    const parsedLng = parseCoordinateInput(form.longitude);
    const parsedRadius = parseRadiusInput(form.radius);

    if (parsedLat === null) {
      setFormError('Latitude wajib diisi dengan angka desimal yang valid.');
      return;
    }
    if (parsedLng === null) {
      setFormError('Longitude wajib diisi dengan angka desimal yang valid.');
      return;
    }
    if (parsedRadius === null) {
      setFormError('Radius presensi wajib diisi dengan angka meter yang valid.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      building: form.building.trim(),
      floor: form.floor.trim(),
      latitude: parsedLat,
      longitude: parsedLng,
      radius: parsedRadius,
    };

    const validationError = validateLaboratoryInput(payload);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const caller = { uid: activeUser.id, role: activeRole };
      if (editingLab) {
        await updateLaboratory(editingLab.id, payload, caller);
        setModalVisible(false);
        Alert.alert(
          'Berhasil',
          `Data laboratorium "${payload.name}" berhasil diperbarui.`,
        );
      } else {
        await createLaboratory(payload, caller);
        setModalVisible(false);
        Alert.alert(
          'Berhasil',
          `Laboratorium "${payload.name}" berhasil ditambahkan.`,
        );
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan data laboratorium.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRequestDelete = (lab: Laboratory) => {
    const usage = findSchedulesReferencingLaboratory(lab, schedules);
    if (usage.openSchedules.length > 0) {
      const activeCourse = usage.openSchedules[0];
      Alert.alert(
        'Laboratorium Sedang Digunakan',
        `Laboratorium "${lab.name}" tidak dapat dihapus karena sedang dipakai oleh sesi berstatus DIBUKA (${activeCourse.courseName} · ${activeCourse.className}). Tutup sesi terlebih dahulu.`,
      );
      return;
    }
    setDeleteTarget(lab);
  };

  const executeDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteLaboratory(deleteTarget.id, {
        uid: activeUser.id,
        role: activeRole,
      });
      setDeleteTarget(null);
    } catch (err) {
      setDeleteTarget(null);
      Alert.alert(
        'Gagal Menghapus',
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat menghapus laboratorium.',
      );
    } finally {
      setDeleting(false);
    }
  };

  const renderLabItem = ({
    item,
    index,
  }: {
    item: Laboratory;
    index: number;
  }) => (
    <View
      style={[
        styles.labCard,
        index % 2 === 1 && styles.labCardTint,
      ]}>
      <View style={styles.cardHeader}>
        <Text style={styles.labName} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.radiusPill}>
          <Text style={styles.radiusPillText}>Radius {item.radius} m</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Ionicons
          name="business-outline"
          size={15}
          color={APP_COLORS.textSecondary}
        />
        <Text style={styles.metaText} numberOfLines={1}>
          {item.building} · Lantai {item.floor}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Ionicons
          name="navigate-outline"
          size={15}
          color={APP_COLORS.textSecondary}
        />
        <Text style={styles.coordsText} numberOfLines={1}>
          Lat {item.latitude.toFixed(6)} · Lng {item.longitude.toFixed(6)}
        </Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={() => openEditModal(item)}
          accessibilityRole="button"
          accessibilityLabel={`Ubah ${item.name}`}
          style={({ pressed }) => [
            styles.editButton,
            pressed && styles.pressed,
          ]}>
          <Ionicons
            name="create-outline"
            size={16}
            color={APP_COLORS.inkPrimary}
          />
          <Text style={styles.editText}>Ubah</Text>
        </Pressable>

        <Pressable
          onPress={() => handleRequestDelete(item)}
          accessibilityRole="button"
          accessibilityLabel={`Hapus ${item.name}`}
          style={({ pressed }) => [
            styles.deleteButton,
            pressed && styles.pressed,
          ]}>
          <Ionicons
            name="trash-outline"
            size={16}
            color={APP_COLORS.dangerText}
          />
          <Text style={styles.deleteText}>Hapus</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title="Lokasi Laboratorium"
        subtitle={`${laboratories.length} laboratorium terdaftar`}
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <FlatList
        data={error ? [] : laboratories}
        keyExtractor={(item) => item.id}
        renderItem={renderLabItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.headingRow}>
              <Text style={styles.heading}>Daftar Lab & Radius</Text>
              <CustomButton
                title="Tambah Lab"
                variant="primary"
                size="sm"
                fullWidth={false}
                leftIcon={
                  <Ionicons name="add" size={16} color={APP_COLORS.white} />
                }
                onPress={openCreateModal}
              />
            </View>

            {loading && (
              <View style={styles.stateBox}>
                <ActivityIndicator color={APP_COLORS.primary} />
                <Text style={styles.stateText}>Memuat data laboratorium...</Text>
              </View>
            )}

            {!!error && (
              <EmptyState
                icon="alert-circle-outline"
                title="Gagal Memuat Laboratorium"
                description={error}
              />
            )}
          </View>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <EmptyState
              icon="location-outline"
              title="Belum Ada Laboratorium"
              description="Tambahkan lokasi laboratorium beserta koordinat dan radius presensi agar dapat dipakai jadwal dan peta."
              actionTitle="Tambah Laboratorium"
              onActionPress={openCreateModal}
            />
          ) : undefined
        }
      />

      {/* Modal Tambah / Ubah Laboratorium */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => {
          if (!saving) setModalVisible(false);
        }}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingLab ? 'Ubah Laboratorium' : 'Tambah Laboratorium'}
              </Text>
              <Pressable
                onPress={() => {
                  if (!saving) setModalVisible(false);
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Tutup"
                style={styles.closeCircleBtn}>
                <Ionicons name="close" size={20} color={APP_COLORS.inkPrimary} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <LabFormField
                label="Nama Laboratorium *"
                value={form.name}
                onChangeText={(value) => updateField('name', value)}
                placeholder="Contoh: Lab Komputer 1"
                editable={!saving}
              />

              <LabFormField
                label="Gedung *"
                value={form.building}
                onChangeText={(value) => updateField('building', value)}
                placeholder="Contoh: Gedung Ilmu Komputer"
                editable={!saving}
              />

              <LabFormField
                label="Lantai *"
                value={form.floor}
                onChangeText={(value) => updateField('floor', value)}
                placeholder="Contoh: 2 atau Lantai 2"
                editable={!saving}
              />

              {/* Bagian Koordinat & Ambil Lokasi Perangkat */}
              <View style={styles.sectionBox}>
                <View style={styles.sectionBoxHeader}>
                  <Text style={styles.sectionBoxTitle}>Koordinat GPS</Text>
                  {gpsAccuracy !== null && (
                    <Text style={styles.accuracyBadge}>
                      Akurasi ±{Math.round(gpsAccuracy)} m
                    </Text>
                  )}
                </View>

                <CustomButton
                  title={
                    fetchingGps
                      ? 'Mengambil Lokasi...'
                      : 'Gunakan Lokasi Saat Ini'
                  }
                  variant="secondary"
                  size="md"
                  loading={fetchingGps}
                  disabled={fetchingGps || saving}
                  leftIcon={
                    !fetchingGps ? (
                      <Ionicons
                        name="locate-outline"
                        size={18}
                        color={APP_COLORS.tetsuKon}
                      />
                    ) : undefined
                  }
                  onPress={handleUseCurrentLocation}
                  style={styles.gpsButton}
                />

                {gpsError && (
                  <View style={styles.gpsErrorBox}>
                    <View style={styles.gpsErrorTextWrap}>
                      <Text style={styles.gpsErrorTitle}>{gpsError.title}</Text>
                      <Text style={styles.gpsErrorMessage}>
                        {gpsError.message}
                      </Text>
                    </View>
                    {gpsError.canOpenSettings && (
                      <CustomButton
                        title="Buka Pengaturan"
                        variant="outline"
                        size="sm"
                        fullWidth={false}
                        onPress={openSettings}
                        style={styles.settingsButton}
                      />
                    )}
                  </View>
                )}

                <View style={styles.coordRow}>
                  <View style={styles.coordCol}>
                    <LabFormField
                      label="Latitude *"
                      value={form.latitude}
                      onChangeText={(value) => updateField('latitude', value)}
                      placeholder="-7.795580"
                      keyboardType="numbers-and-punctuation"
                      editable={!saving}
                    />
                  </View>
                  <View style={styles.coordCol}>
                    <LabFormField
                      label="Longitude *"
                      value={form.longitude}
                      onChangeText={(value) => updateField('longitude', value)}
                      placeholder="110.369490"
                      keyboardType="numbers-and-punctuation"
                      editable={!saving}
                    />
                  </View>
                </View>
              </View>

              {/* Bagian Radius Presensi */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Radius Presensi (meter) *</Text>
                <View style={styles.presetRow}>
                  {RADIUS_PRESETS.map((preset) => {
                    const active = form.radius.trim() === String(preset);
                    return (
                      <Pressable
                        key={preset}
                        onPress={() => updateField('radius', String(preset))}
                        disabled={saving}
                        accessibilityRole="button"
                        accessibilityLabel={`Pilih radius ${preset} meter`}
                        style={[
                          styles.presetChip,
                          active && styles.presetChipActive,
                        ]}>
                        <Text
                          style={[
                            styles.presetChipText,
                            active && styles.presetChipTextActive,
                          ]}>
                          {preset} m
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <TextInput
                  value={form.radius}
                  onChangeText={(value) => updateField('radius', value)}
                  placeholder="Contoh: 50"
                  placeholderTextColor={APP_COLORS.neutral400}
                  keyboardType="numeric"
                  editable={!saving}
                  style={styles.input}
                />
                <Text style={styles.helperText}>
                  Rentang radius yang diizinkan: 5 – 5000 meter.
                </Text>
              </View>

              {formError && (
                <View style={styles.formErrorBox}>
                  <Ionicons
                    name="alert-circle"
                    size={16}
                    color={APP_COLORS.dangerText}
                  />
                  <Text style={styles.formErrorText}>{formError}</Text>
                </View>
              )}

              <CustomButton
                title={editingLab ? 'Simpan Perubahan' : 'Simpan Laboratorium'}
                variant="primary"
                size="lg"
                loading={saving}
                disabled={saving}
                onPress={handleSave}
                style={styles.saveButton}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <ConfirmModal
        visible={Boolean(deleteTarget)}
        title="Hapus Laboratorium?"
        subtitle={
          deleteUsageSummary.otherSchedules.length > 0
            ? `Peringatan: Terdapat ${deleteUsageSummary.otherSchedules.length} jadwal non-aktif yang merujuk ke laboratorium ini. Data yang dihapus tidak dapat dipulihkan.`
            : 'Data lokasi laboratorium yang dihapus tidak dapat dipulihkan.'
        }
        details={
          deleteTarget
            ? {
                courseName: deleteTarget.name,
                className: `${deleteTarget.building} · Lantai ${deleteTarget.floor}`,
                time: `Lat ${deleteTarget.latitude.toFixed(5)}, Lng ${deleteTarget.longitude.toFixed(5)}`,
                room: `Radius ${deleteTarget.radius} m`,
              }
            : undefined
        }
        confirmText="Ya, Hapus"
        cancelText="Batal"
        confirmVariant="danger"
        loading={deleting}
        onConfirm={executeDelete}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />

      <BottomNavigation
        role={activeRole}
        activeTab={activeNavTab}
        onTabChange={(tabKey) => navigation.navigate(tabKey)}
      />
    </SafeAreaView>
  );
};

const LabFormField: React.FC<{
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric' | 'numbers-and-punctuation';
  editable?: boolean;
}> = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  editable = true,
}) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={APP_COLORS.neutral400}
      keyboardType={keyboardType}
      editable={editable}
      style={styles.input}
      autoCapitalize={keyboardType === 'default' ? 'words' : 'none'}
    />
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  restrictedWrapper: {
    flex: 1,
    justifyContent: 'center',
    padding: APP_SPACING.lg,
  },
  listContent: {
    paddingHorizontal: APP_SPACING.lg,
    paddingTop: APP_SPACING.xs,
    paddingBottom: APP_SPACING.xxl,
    gap: APP_SPACING.sm,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: APP_SPACING.sm,
    marginBottom: APP_SPACING.md,
  },
  heading: {
    fontFamily: APP_FONTS.bold,
    fontSize: 17,
    color: APP_COLORS.inkPrimary,
    flex: 1,
  },
  stateBox: {
    alignItems: 'center',
    padding: APP_SPACING.xl,
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    gap: 8,
    marginBottom: APP_SPACING.md,
  },
  stateText: {
    fontFamily: APP_FONTS.medium,
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  labCard: {
    padding: APP_SPACING.lg,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  labCardTint: {
    backgroundColor: APP_COLORS.nordicBreeze,
    borderColor: APP_COLORS.nordicBreeze,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: APP_SPACING.sm,
    marginBottom: APP_SPACING.sm,
  },
  labName: {
    flex: 1,
    fontFamily: APP_FONTS.bold,
    fontSize: 15,
    lineHeight: 21,
    color: APP_COLORS.inkPrimary,
  },
  radiusPill: {
    backgroundColor: APP_COLORS.softBlue,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: APP_RADIUS.pill,
  },
  radiusPillText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 11,
    color: APP_COLORS.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metaText: {
    flex: 1,
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
  },
  coordsText: {
    flex: 1,
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: APP_SPACING.md,
    borderTopWidth: 1,
    borderTopColor: APP_COLORS.divider,
    paddingTop: APP_SPACING.md,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: APP_RADIUS.md,
    backgroundColor: APP_COLORS.softBlue,
  },
  editText: {
    fontFamily: APP_FONTS.bold,
    color: APP_COLORS.inkPrimary,
    fontSize: 13,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: APP_RADIUS.md,
    backgroundColor: APP_COLORS.dangerSoft,
  },
  deleteText: {
    fontFamily: APP_FONTS.bold,
    color: APP_COLORS.dangerText,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 24, 75, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: APP_COLORS.background,
    padding: APP_SPACING.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: APP_SPACING.md,
  },
  modalTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 19,
    color: APP_COLORS.inkPrimary,
  },
  closeCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: {
    marginBottom: APP_SPACING.md,
  },
  fieldLabel: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 13,
    color: APP_COLORS.inkPrimary,
    marginBottom: 6,
  },
  input: {
    fontFamily: APP_FONTS.regular,
    minHeight: 46,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: APP_RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: APP_COLORS.inkPrimary,
    backgroundColor: APP_COLORS.white,
    fontSize: 14,
  },
  helperText: {
    fontFamily: APP_FONTS.regular,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 4,
  },
  sectionBox: {
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    padding: APP_SPACING.md,
    marginBottom: APP_SPACING.md,
  },
  sectionBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: APP_SPACING.sm,
  },
  sectionBoxTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
  },
  accuracyBadge: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 11,
    color: APP_COLORS.opened,
    backgroundColor: APP_COLORS.openedSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: APP_RADIUS.pill,
  },
  gpsButton: {
    marginBottom: APP_SPACING.sm,
  },
  gpsErrorBox: {
    backgroundColor: APP_COLORS.dangerSoft,
    borderRadius: APP_RADIUS.md,
    padding: APP_SPACING.md,
    marginBottom: APP_SPACING.sm,
    gap: APP_SPACING.sm,
  },
  gpsErrorTextWrap: {
    gap: 2,
  },
  gpsErrorTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 13,
    color: APP_COLORS.dangerText,
  },
  gpsErrorMessage: {
    fontFamily: APP_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    color: APP_COLORS.inkPrimary,
  },
  settingsButton: {
    marginTop: 2,
  },
  coordRow: {
    flexDirection: 'row',
    gap: APP_SPACING.sm,
  },
  coordCol: {
    flex: 1,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: APP_SPACING.sm,
  },
  presetChip: {
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: APP_RADIUS.pill,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    justifyContent: 'center',
  },
  presetChipActive: {
    backgroundColor: APP_COLORS.primary,
    borderColor: APP_COLORS.primary,
  },
  presetChipText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  presetChipTextActive: {
    color: APP_COLORS.white,
  },
  formErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: APP_COLORS.dangerSoft,
    borderRadius: APP_RADIUS.md,
    padding: APP_SPACING.md,
    marginBottom: APP_SPACING.md,
  },
  formErrorText: {
    flex: 1,
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: APP_COLORS.dangerText,
    lineHeight: 18,
  },
  saveButton: {
    marginTop: 4,
    marginBottom: 16,
  },
  pressed: {
    opacity: 0.78,
  },
});

export default LaboratoryManagementScreen;
