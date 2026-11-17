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
import { NavigationProp } from '@/navigation/navigationTypes';
import { useFirestoreSchedules } from '@/hooks/useFirestoreSchedules';
import {
  createPracticumSchedule,
  deletePracticumSchedule,
  getStudentDirectory,
  PracticumSchedule,
  ScheduleInput,
  StudentOption,
  updatePracticumSchedule,
} from '@/services/practicumScheduleService';
import { APP_COLORS, APP_SPACING } from '@/constants/theme';

interface ScheduleScreenProps {
  navigation: NavigationProp;
}

const emptyForm = (): ScheduleInput => ({
  courseName: '',
  className: '',
  room: '',
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
          err.message || 'Periksa koneksi dan izin Firestore.',
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
    setForm({
      courseName: schedule.courseName,
      className: schedule.className,
      room: schedule.room,
      date: schedule.date,
      time: schedule.time,
      enrolledStudents: [...schedule.enrolledStudents],
    });
    setModalVisible(true);
    loadStudents();
  };

  const updateField = (field: keyof ScheduleInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
        Alert.alert('Berhasil', 'Jadwal praktikum berhasil diperbarui.');
      } else {
        await createPracticumSchedule(form, {
          uid: activeUser.id,
          name: activeUser.name,
        });
        Alert.alert('Berhasil', 'Jadwal praktikum berhasil ditambahkan ke Firestore.');
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
        'Tutup sesi terlebih dahulu sebelum menghapus jadwal.',
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
        err instanceof Error ? err.message : 'Periksa izin Firestore.',
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title="Jadwal Praktikum"
        subtitle={
          isAssistant
            ? 'Kelola sesi & peserta praktikum'
            : 'Daftar sesi praktikum Anda'
        }
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.heading}>Semua Sesi</Text>
            <Text style={styles.subheading}>
              {sortedSchedules.length} sesi terdaftar di Cloud Firestore
            </Text>
          </View>
          {isAssistant && (
            <Pressable
              style={({ pressed }) => [
                styles.addPillButton,
                pressed && styles.pressed,
              ]}
              onPress={openCreate}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addPillButtonText}>Jadwal Baru</Text>
            </Pressable>
          )}
        </View>

        {loading && (
          <View style={styles.stateBox}>
            <ActivityIndicator color={APP_COLORS.primary} />
            <Text style={styles.stateText}>Memuat jadwal dari Firestore...</Text>
          </View>
        )}
        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={APP_COLORS.error}
            />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {!loading && !error && sortedSchedules.length === 0 && (
          <View style={styles.stateBox}>
            <Ionicons
              name="calendar-outline"
              size={34}
              color={APP_COLORS.neutral400}
            />
            <Text style={styles.emptyTitle}>Belum ada jadwal</Text>
            <Text style={styles.stateText}>
              {isAssistant
                ? 'Tekan tombol + Jadwal Baru untuk membuat sesi praktikum pertama.'
                : 'Asisten belum mendaftarkan akunmu ke jadwal praktikum.'}
            </Text>
          </View>
        )}

        <View style={styles.list}>
          {sortedSchedules.map((schedule) => (
            <View key={schedule.id} style={styles.scheduleCard}>
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

                <View style={styles.chipsRow}>
                  <View style={[styles.chip, styles.chipPurple]}>
                    <Text style={styles.chipPurpleText}>
                      {schedule.className}
                    </Text>
                  </View>
                  <View style={[styles.chip, styles.chipBlue]}>
                    <Text style={styles.chipBlueText}>{schedule.room}</Text>
                  </View>
                  <View style={[styles.chip, styles.chipGreen]}>
                    <Text style={styles.chipGreenText}>
                      {schedule.totalStudents} peserta
                    </Text>
                  </View>
                </View>

                <View style={styles.cardBottomRow}>
                  <View style={styles.dateRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color="#475569"
                    />
                    <Text style={styles.dateText}>{schedule.date}</Text>
                  </View>
                  <View style={styles.darkTimeBadge}>
                    <Text style={styles.darkTimeText}>{schedule.time}</Text>
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
                      color="#0F172A"
                    />
                    <Text style={styles.editText}>Ubah Jadwal</Text>
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
                      color={APP_COLORS.error}
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
                {editingSchedule ? 'Ubah Jadwal' : 'Buat Jadwal Baru'}
              </Text>
              <Pressable
                onPress={() => setModalVisible(false)}
                hitSlop={10}
                style={styles.closeCircleBtn}>
                <Ionicons name="close" size={20} color="#0F172A" />
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
                  Belum ada profil praktikan dengan role student.
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
                        color={selected ? '#0F172A' : APP_COLORS.neutral400}
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
              <Pressable
                style={[styles.saveButton, saving && styles.disabledButton]}
                disabled={saving}
                onPress={saveSchedule}>
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingSchedule ? 'Simpan Perubahan' : 'Simpan Jadwal'}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={Boolean(deleteTarget)}
        title="Hapus Jadwal?"
        subtitle="Jadwal praktikum yang dihapus tidak dapat dipulihkan kembali."
        details={
          deleteTarget
            ? {
                courseName: deleteTarget.courseName,
                className: deleteTarget.className,
                time: `${deleteTarget.date} • ${deleteTarget.time}`,
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
    backgroundColor: '#F5F6FA',
  },
  content: {
    paddingHorizontal: APP_SPACING.lg,
    paddingTop: APP_SPACING.sm,
    paddingBottom: 36,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headingCopy: {
    flex: 1,
    marginRight: 8,
  },
  heading: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  subheading: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  addPillButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  addPillButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  list: {
    gap: 12,
  },
  scheduleCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  courseTitle: {
    flex: 1,
    fontSize: 17,
    color: '#0F172A',
    fontWeight: '900',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipPurple: {
    backgroundColor: '#F3E8FF',
  },
  chipPurpleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B21A8',
  },
  chipBlue: {
    backgroundColor: '#DBEAFE',
  },
  chipBlueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  chipGreen: {
    backgroundColor: '#DCFCE7',
  },
  chipGreenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
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
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  darkTimeBadge: {
    backgroundColor: '#181824',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 10,
  },
  darkTimeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#C7D2FE',
    borderWidth: 1,
    borderColor: '#0F172A',
  },
  editText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteText: {
    color: APP_COLORS.error,
    fontSize: 12,
    fontWeight: '800',
  },
  stateBox: {
    alignItems: 'center',
    padding: 26,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#0F172A',
    gap: 9,
    marginBottom: 14,
  },
  stateText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    color: APP_COLORS.error,
    fontSize: 12,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '90%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FDFBF7',
    padding: 20,
    borderTopWidth: 2,
    borderColor: '#0F172A',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    color: '#0F172A',
    fontWeight: '900',
  },
  closeCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '800',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#0F172A',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  studentChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6,
  },
  studentChoiceSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#0F172A',
  },
  studentChoiceCopy: {
    flex: 1,
  },
  studentChoiceName: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '800',
  },
  studentChoiceMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  selectionHint: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 6,
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: '#0F172A',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.78,
  },
});

export default ScheduleScreen;
