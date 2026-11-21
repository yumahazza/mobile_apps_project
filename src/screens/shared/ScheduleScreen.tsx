import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { ConfirmModal } from '@/components/ConfirmModal';
import { StatusBadge } from '@/components/StatusBadge';
import { AppHeader } from '@/components/AppHeader';
import { BottomNavigation } from '@/components/BottomNavigation';
import { EmptyState } from '@/components/EmptyState';
import { CustomButton } from '@/components/CustomButton';
import { NavigationProp } from '@/navigation/navigationTypes';
import { useFirestoreSchedules } from '@/hooks/useFirestoreSchedules';
import { useLaboratories } from '@/hooks/useLaboratories';
import { resolveLaboratoryForSchedule } from '@/services/laboratoryService';
import type { Laboratory } from '@/types/laboratory';
import {
  createPracticumSchedule,
  deletePracticumSchedule,
  getStudentDirectory,
  PracticumSchedule,
  ScheduleInput,
  StudentOption,
  updatePracticumSchedule,
} from '@/services/practicumScheduleService';
import {
  APP_COLORS,
  APP_FONTS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

interface ScheduleScreenProps {
  navigation: NavigationProp;
}

const emptyForm = (): ScheduleInput => ({
  courseName: '',
  className: '',
  room: '',
  laboratoryId: null,
  date: new Date().toISOString().slice(0, 10),
  time: '08:00 - 10:00',
  enrolledStudents: [],
});

export const ScheduleScreen: React.FC<ScheduleScreenProps> = ({ navigation }) => {
  const { activeUser, activeRole, setActiveScheduleId } = useApp();
  const { schedules, loading, error } = useFirestoreSchedules(
    activeUser.id,
    activeRole,
  );
  const isAssistant = activeRole === 'assistant';
  const { laboratories, loading: loadingLaboratories } = useLaboratories(
    isAssistant ? activeUser.id : undefined,
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<PracticumSchedule | null>(null);
  const [form, setForm] = useState<ScheduleInput>(emptyForm);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PracticumSchedule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sortedSchedules = useMemo(
    () =>
      [...schedules].sort(
        (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
      ),
    [schedules],
  );

  const loadStudents = () => {
    if (!isAssistant) return;
    setLoadingStudents(true);
    getStudentDirectory()
      .then((list) => setStudents(list))
      .catch((err) =>
        Alert.alert(
          'Gagal memuat praktikan',
          err.message || 'Periksa koneksi dan izin akses.',
        ),
      )
      .finally(() => setLoadingStudents(false));
  };

  const openCreate = () => {
    setEditingSchedule(null);
    setForm(emptyForm());
    setModalVisible(true);
    loadStudents();
  };

  const openEdit = (schedule: PracticumSchedule) => {
    setEditingSchedule(schedule);
    const matchedLab = resolveLaboratoryForSchedule(schedule, laboratories);
    setForm({
      courseName: schedule.courseName,
      className: schedule.className,
      room: schedule.room,
      laboratoryId: schedule.laboratoryId ?? matchedLab?.id ?? null,
      date: schedule.date,
      time: schedule.time,
      enrolledStudents: [...schedule.enrolledStudents],
    });
    setModalVisible(true);
    loadStudents();
  };

  const updateField = (field: keyof ScheduleInput, value: string) => {
    setForm((prev) => {
      if (field !== 'room') {
        return { ...prev, [field]: value };
      }
      const selectedLab = laboratories.find((lab) => lab.id === prev.laboratoryId);
      const keepLabId =
        selectedLab &&
        selectedLab.name.trim().toLowerCase() === value.trim().toLowerCase()
          ? prev.laboratoryId
          : null;
      return { ...prev, room: value, laboratoryId: keepLabId };
    });
  };

  const selectLaboratory = (lab: Laboratory) => {
    setForm((prev) => {
      if (prev.laboratoryId === lab.id) {
        return { ...prev, laboratoryId: null };
      }
      return {
        ...prev,
        laboratoryId: lab.id,
        room: lab.name,
      };
    });
  };

  const toggleStudent = (uid: string) => {
    setForm((prev) => ({
      ...prev,
      enrolledStudents: prev.enrolledStudents.includes(uid)
        ? prev.enrolledStudents.filter((item) => item !== uid)
        : [...prev.enrolledStudents, uid],
    }));
  };

  const saveSchedule = async () => {
    setSaving(true);
    try {
      if (editingSchedule) {
        await updatePracticumSchedule(editingSchedule.id, form);
        Alert.alert('Berhasil', 'Jadwal berhasil diperbarui.');
      } else {
        await createPracticumSchedule(form, {
          uid: activeUser.id,
          name: activeUser.name,
        });
        Alert.alert('Berhasil', 'Jadwal baru berhasil dibuat.');
      }
      setModalVisible(false);
    } catch (err) {
      Alert.alert(
        'Gagal menyimpan jadwal',
        err instanceof Error ? err.message : 'Terjadi kesalahan.',
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (schedule: PracticumSchedule) => {
    if (schedule.status === 'DIBUKA') {
      Alert.alert(
        'Jadwal sedang dibuka',
        'Tutup sesi terlebih dahulu sebelum menghapus.',
      );
      return;
    }
    setDeleteTarget(schedule);
  };

  const executeDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deletePracticumSchedule(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      Alert.alert(
        'Gagal menghapus',
        err instanceof Error ? err.message : 'Periksa izin akses.',
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title="Jadwal Praktikum"
        subtitle={`${sortedSchedules.length} sesi terdaftar`}
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow}>
          <Text style={styles.heading}>Semua Sesi</Text>
          {isAssistant && (
            <View style={styles.headingActions}>
              <CustomButton
                title="Kelola Lab"
                variant="secondary"
                size="sm"
                fullWidth={false}
                leftIcon={
                  <Ionicons
                    name="location-outline"
                    size={15}
                    color={APP_COLORS.tetsuKon}
                  />
                }
                onPress={() =>
                  navigation.navigate('LaboratoryManagement', {
                    fromTab: 'ScheduleList',
                  })
                }
              />
              <CustomButton
                title="Jadwal Baru"
                variant="primary"
                size="sm"
                fullWidth={false}
                leftIcon={<Ionicons name="add" size={16} color={APP_COLORS.white} />}
                onPress={openCreate}
              />
            </View>
          )}
        </View>

        {loading && (
          <View style={styles.stateBox}>
            <ActivityIndicator color={APP_COLORS.primary} />
            <Text style={styles.stateText}>Memuat jadwal...</Text>
          </View>
        )}

        {!!error && (
          <EmptyState
            icon="alert-circle-outline"
            title="Gagal Memuat Jadwal"
            description={error}
          />
        )}

        {!loading && !error && sortedSchedules.length === 0 && (
          <EmptyState
            icon="calendar-outline"
            title="Belum Ada Jadwal"
            description={
              isAssistant
                ? 'Tambahkan sesi praktikum pertama Anda.'
                : 'Belum ada jadwal untuk akun Anda.'
            }
          />
        )}

        <View style={styles.list}>
          {sortedSchedules.map((schedule, idx) => (
            <View
              key={schedule.id}
              style={[
                styles.scheduleCard,
                idx % 2 === 1 && styles.scheduleCardTint,
              ]}>
              <Pressable
                onPress={() => {
                  setActiveScheduleId(schedule.id);
                  navigation.navigate('SessionDetail', {
                    scheduleId: schedule.id,
                  });
                }}>
                <View style={styles.cardTop}>
                  <Text style={styles.courseTitle} numberOfLines={1}>
                    {schedule.courseName}
                  </Text>
                  <StatusBadge status={schedule.status} size="sm" />
                </View>

                <Text style={styles.metaText} numberOfLines={1}>
                  {schedule.className} · {schedule.room} · {schedule.totalStudents} peserta
                </Text>

                <View style={styles.cardBottomRow}>
                  <View style={styles.dateRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color={APP_COLORS.textSecondary}
                    />
                    <Text style={styles.dateText}>{schedule.date}</Text>
                  </View>
                  <View style={styles.timeBadge}>
                    <Text style={styles.timeText}>{schedule.time}</Text>
                  </View>
                </View>
              </Pressable>

              {isAssistant && (
                <View style={styles.actionRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.editButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => openEdit(schedule)}>
                    <Ionicons
                      name="create-outline"
                      size={15}
                      color={APP_COLORS.inkPrimary}
                    />
                    <Text style={styles.editText}>Ubah</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => confirmDelete(schedule)}>
                    <Ionicons
                      name="trash-outline"
                      size={15}
                      color={APP_COLORS.dangerText}
                    />
                    <Text style={styles.deleteText}>Hapus</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingSchedule ? 'Ubah Jadwal' : 'Jadwal Baru'}
              </Text>
              <Pressable
                onPress={() => setModalVisible(false)}
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
              <FormField
                label="Mata Praktikum"
                value={form.courseName}
                onChangeText={(value) => updateField('courseName', value)}
                placeholder="Contoh: Pemrograman Mobile"
              />
              <FormField
                label="Kelas"
                value={form.className}
                onChangeText={(value) => updateField('className', value)}
                placeholder="Contoh: Kelas A"
              />
              <View style={styles.fieldGroup}>
                <View style={styles.labPickerHeader}>
                  <Text style={styles.fieldLabel}>
                    Pilih Laboratorium (Opsional)
                  </Text>
                  <Pressable
                    onPress={() => {
                      setModalVisible(false);
                      navigation.navigate('LaboratoryManagement', {
                        fromTab: 'ScheduleList',
                      });
                    }}
                    hitSlop={6}>
                    <Text style={styles.manageLabLink}>Kelola Lab</Text>
                  </Pressable>
                </View>

                {loadingLaboratories ? (
                  <ActivityIndicator color={APP_COLORS.primary} />
                ) : laboratories.length === 0 ? (
                  <Text style={styles.labPickerEmpty}>
                    Belum ada laboratorium tersimpan. Anda tetap bisa mengisi nama ruangan secara manual di bawah.
                  </Text>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.labChipsRow}>
                    {laboratories.map((lab) => {
                      const isSelected = form.laboratoryId === lab.id;
                      return (
                        <Pressable
                          key={lab.id}
                          onPress={() => selectLaboratory(lab)}
                          style={[
                            styles.labChip,
                            isSelected && styles.labChipSelected,
                          ]}>
                          <Text
                            style={[
                              styles.labChipTitle,
                              isSelected && styles.labChipTitleSelected,
                            ]}
                            numberOfLines={1}>
                            {lab.name}
                          </Text>
                          <Text
                            style={[
                              styles.labChipMeta,
                              isSelected && styles.labChipMetaSelected,
                            ]}
                            numberOfLines={1}>
                            {lab.building} · {lab.radius} m
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
              <FormField
                label="Ruangan"
                value={form.room}
                onChangeText={(value) => updateField('room', value)}
                placeholder="Contoh: Lab Komputer 1"
              />
              <FormField
                label="Tanggal (YYYY-MM-DD)"
                value={form.date}
                onChangeText={(value) => updateField('date', value)}
                placeholder="2026-11-20"
              />
              <FormField
                label="Waktu (HH:mm - HH:mm)"
                value={form.time}
                onChangeText={(value) => updateField('time', value)}
                placeholder="08:00 - 10:00"
              />
              <Text style={styles.fieldLabel}>Peserta Praktikum</Text>
              {loadingStudents ? (
                <ActivityIndicator color={APP_COLORS.primary} />
              ) : students.length === 0 ? (
                <Text style={styles.stateText}>
                  Belum ada akun praktikan terdaftar.
                </Text>
              ) : (
                students.map((student) => {
                  const selected = form.enrolledStudents.includes(student.uid);
                  return (
                    <Pressable
                      key={student.uid}
                      style={[
                        styles.studentChoice,
                        selected && styles.studentChoiceSelected,
                      ]}
                      onPress={() => toggleStudent(student.uid)}>
                      <Ionicons
                        name={selected ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={selected ? APP_COLORS.primary : APP_COLORS.neutral400}
                      />
                      <View style={styles.studentChoiceCopy}>
                        <Text style={styles.studentChoiceName}>
                          {student.name}
                        </Text>
                        <Text style={styles.studentChoiceMeta}>
                          {student.nim || student.email || student.uid}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
              <Text style={styles.selectionHint}>
                {form.enrolledStudents.length} peserta dipilih
              </Text>
              <CustomButton
                title={editingSchedule ? 'Simpan Perubahan' : 'Simpan Jadwal'}
                variant="primary"
                size="lg"
                loading={saving}
                disabled={saving}
                onPress={saveSchedule}
                style={styles.saveButton}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={Boolean(deleteTarget)}
        title="Hapus Jadwal?"
        subtitle="Jadwal yang dihapus tidak dapat dipulihkan."
        details={
          deleteTarget
            ? {
                courseName: deleteTarget.courseName,
                className: deleteTarget.className,
                time: `${deleteTarget.date} · ${deleteTarget.time}`,
                room: deleteTarget.room,
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
        activeTab="ScheduleList"
        onTabChange={(tabKey) => navigation.navigate(tabKey)}
      />
    </SafeAreaView>
  );
};

const FormField: React.FC<{
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}> = ({ label, value, onChangeText, placeholder }) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={APP_COLORS.neutral400}
      style={styles.input}
      autoCapitalize="sentences"
    />
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  content: {
    paddingHorizontal: APP_SPACING.lg,
    paddingTop: APP_SPACING.xs,
    paddingBottom: APP_SPACING.xxl,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: APP_SPACING.sm,
    marginBottom: APP_SPACING.md,
  },
  headingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_SPACING.sm,
  },
  heading: {
    fontFamily: APP_FONTS.bold,
    fontSize: 17,
    color: APP_COLORS.inkPrimary,
    flex: 1,
  },
  list: {
    gap: APP_SPACING.sm,
  },
  scheduleCard: {
    padding: APP_SPACING.lg,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  scheduleCardTint: {
    backgroundColor: APP_COLORS.nordicBreeze,
    borderColor: APP_COLORS.nordicBreeze,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  courseTitle: {
    flex: 1,
    fontFamily: APP_FONTS.bold,
    fontSize: 15,
    color: APP_COLORS.inkPrimary,
  },
  metaText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginBottom: APP_SPACING.sm,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  timeBadge: {
    backgroundColor: APP_COLORS.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: APP_RADIUS.sm,
  },
  timeText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 11,
    color: APP_COLORS.inkPrimary,
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
    minHeight: 40,
    borderRadius: APP_RADIUS.md,
    backgroundColor: APP_COLORS.softBlue,
  },
  editText: {
    fontFamily: APP_FONTS.bold,
    color: APP_COLORS.inkPrimary,
    fontSize: 12,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: APP_RADIUS.md,
    backgroundColor: APP_COLORS.dangerSoft,
  },
  deleteText: {
    fontFamily: APP_FONTS.bold,
    color: APP_COLORS.dangerText,
    fontSize: 12,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 24, 75, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '90%',
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
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.inkPrimary,
    marginBottom: 6,
  },
  input: {
    fontFamily: APP_FONTS.regular,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: APP_RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: APP_COLORS.inkPrimary,
    backgroundColor: APP_COLORS.white,
    fontSize: 14,
  },
  studentChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    borderRadius: APP_RADIUS.md,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: 6,
  },
  studentChoiceSelected: {
    backgroundColor: APP_COLORS.softBlue,
    borderColor: APP_COLORS.primary,
  },
  studentChoiceCopy: {
    flex: 1,
  },
  studentChoiceName: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 13,
    color: APP_COLORS.inkPrimary,
  },
  studentChoiceMeta: {
    fontFamily: APP_FONTS.regular,
    fontSize: 11,
    color: APP_COLORS.textSecondary,
    marginTop: 1,
  },
  selectionHint: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 6,
    marginBottom: 10,
  },
  labPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  manageLabLink: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.primary,
  },
  labPickerEmpty: {
    fontFamily: APP_FONTS.regular,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    lineHeight: 17,
  },
  labChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 2,
  },
  labChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: APP_RADIUS.md,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    minWidth: 140,
    maxWidth: 200,
  },
  labChipSelected: {
    backgroundColor: APP_COLORS.primary,
    borderColor: APP_COLORS.primary,
  },
  labChipTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 13,
    color: APP_COLORS.inkPrimary,
  },
  labChipTitleSelected: {
    color: APP_COLORS.white,
  },
  labChipMeta: {
    fontFamily: APP_FONTS.medium,
    fontSize: 11,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
  },
  labChipMetaSelected: {
    color: APP_COLORS.nordicBreeze,
  },
  saveButton: {
    marginTop: 6,
    marginBottom: 16,
  },
  pressed: {
    opacity: 0.78,
  },
});

export default ScheduleScreen;
