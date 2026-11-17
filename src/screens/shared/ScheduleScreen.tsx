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
import { Card } from '@/components/Card';
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
import { APP_COLORS, APP_RADIUS, APP_SPACING } from '@/constants/theme';

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
    () => [...schedules].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
    [schedules],
  );

  const loadStudents = () => {
    if (!isAssistant) return;
    setLoadingStudents(true);
    getStudentDirectory()
      .then(list => setStudents(list))
      .catch(err => Alert.alert('Gagal memuat praktikan', err.message || 'Periksa koneksi dan izin Firestore.'))
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
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleStudent = (uid: string) => {
    setForm(prev => ({
      ...prev,
      enrolledStudents: prev.enrolledStudents.includes(uid)
        ? prev.enrolledStudents.filter(item => item !== uid)
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
      Alert.alert('Gagal menyimpan jadwal', err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (schedule: PracticumSchedule) => {
    if (schedule.status === 'DIBUKA') {
      Alert.alert('Jadwal sedang dibuka', 'Tutup sesi terlebih dahulu sebelum menghapus jadwal.');
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
      Alert.alert('Gagal menghapus', err instanceof Error ? err.message : 'Periksa izin Firestore.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title="Jadwal Praktikum"
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.heading}>Jadwal Dinamis</Text>
            <Text style={styles.subheading}>
              {isAssistant ? 'Kelola jadwal dan peserta praktikum.' : 'Jadwal yang terdaftar untuk akunmu.'}
            </Text>
          </View>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>REAL-TIME</Text>
          </View>
        </View>

        {isAssistant && (
          <Pressable style={styles.addButton} onPress={openCreate}>
            <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Tambah Jadwal</Text>
          </Pressable>
        )}

        {loading && (
          <View style={styles.stateBox}>
            <ActivityIndicator color={APP_COLORS.primary} />
            <Text style={styles.stateText}>Memuat jadwal dari Firestore...</Text>
          </View>
        )}
        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={APP_COLORS.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {!loading && !error && sortedSchedules.length === 0 && (
          <View style={styles.stateBox}>
            <Ionicons name="calendar-outline" size={34} color={APP_COLORS.neutral400} />
            <Text style={styles.emptyTitle}>Belum ada jadwal</Text>
            <Text style={styles.stateText}>
              {isAssistant ? 'Tekan Tambah Jadwal untuk membuat jadwal pertama.' : 'Asisten belum mendaftarkan akunmu ke jadwal praktikum.'}
            </Text>
          </View>
        )}

        <View style={styles.list}>
          {sortedSchedules.map(schedule => (
            <Card key={schedule.id} style={styles.scheduleCard}>
              <Pressable
                onPress={() => {
                  setActiveScheduleId(schedule.id);
                  navigation.navigate('SessionDetail', { scheduleId: schedule.id });
                }}>
              <View style={styles.cardTop}>
                <StatusBadge status={schedule.status} size="sm" />
                <Text style={styles.dateText}>{schedule.date}</Text>
              </View>
              <Text style={styles.courseTitle}>{schedule.courseName}</Text>
              <Text style={styles.classText}>{schedule.className}</Text>
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={15} color={APP_COLORS.neutral500} />
                <Text style={styles.metaText}>{schedule.time}</Text>
                <Ionicons name="location-outline" size={15} color={APP_COLORS.neutral500} />
                <Text style={styles.metaText}>{schedule.room}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="people-outline" size={15} color={APP_COLORS.neutral500} />
                <Text style={styles.metaText}>{schedule.totalStudents} peserta terdaftar</Text>
              </View>
              </Pressable>
              {isAssistant && (
                <View style={styles.actionRow}>
                  <Pressable style={styles.editButton} onPress={() => openEdit(schedule)}>
                    <Ionicons name="create-outline" size={16} color={APP_COLORS.primary} />
                    <Text style={styles.editText}>Ubah</Text>
                  </Pressable>
                  <Pressable style={styles.deleteButton} onPress={() => confirmDelete(schedule)}>
                    <Ionicons name="trash-outline" size={16} color={APP_COLORS.error} />
                    <Text style={styles.deleteText}>Hapus</Text>
                  </Pressable>
                </View>
              )}
            </Card>
          ))}
        </View>
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingSchedule ? 'Ubah Jadwal' : 'Tambah Jadwal'}</Text>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={APP_COLORS.neutral700} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <FormField label="Mata Praktikum" value={form.courseName} onChangeText={value => updateField('courseName', value)} placeholder="Contoh: Pemrograman Mobile" />
              <FormField label="Kelas" value={form.className} onChangeText={value => updateField('className', value)} placeholder="Contoh: A" />
              <FormField label="Ruangan" value={form.room} onChangeText={value => updateField('room', value)} placeholder="Contoh: Lab Komputer 1" />
              <FormField label="Tanggal (YYYY-MM-DD)" value={form.date} onChangeText={value => updateField('date', value)} placeholder="2026-11-20" />
              <FormField label="Waktu (HH:mm - HH:mm)" value={form.time} onChangeText={value => updateField('time', value)} placeholder="08:00 - 10:00" />
              <Text style={styles.fieldLabel}>Peserta Praktikum</Text>
              {loadingStudents ? (
                <ActivityIndicator color={APP_COLORS.primary} />
              ) : students.length === 0 ? (
                <Text style={styles.stateText}>Belum ada profil praktikan dengan role student.</Text>
              ) : (
                students.map(student => {
                  const selected = form.enrolledStudents.includes(student.uid);
                  return (
                    <Pressable key={student.uid} style={styles.studentChoice} onPress={() => toggleStudent(student.uid)}>
                      <Ionicons
                        name={selected ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={selected ? APP_COLORS.primary : APP_COLORS.neutral400}
                      />
                      <View style={styles.studentChoiceCopy}>
                        <Text style={styles.studentChoiceName}>{student.name}</Text>
                        <Text style={styles.studentChoiceMeta}>{student.nim || student.email || student.uid}</Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
              <Text style={styles.selectionHint}>{form.enrolledStudents.length} peserta dipilih</Text>
              <Pressable
                style={[styles.saveButton, saving && styles.disabledButton]}
                disabled={saving}
                onPress={saveSchedule}>
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>{editingSchedule ? 'Simpan Perubahan' : 'Buat Jadwal'}</Text>}
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
  safeArea: { flex: 1, backgroundColor: APP_COLORS.background },
  content: { padding: APP_SPACING.lg, paddingBottom: 36 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headingCopy: { flex: 1, marginRight: 8 },
  heading: { fontSize: 21, fontWeight: '800', color: APP_COLORS.navyHeading },
  subheading: { marginTop: 4, color: APP_COLORS.textSecondary, fontSize: 13 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EAF8F0', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16A34A' },
  liveText: { fontSize: 10, fontWeight: '800', color: '#15803D' },
  addButton: { backgroundColor: APP_COLORS.primary, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  addButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  list: { gap: 12 },
  scheduleCard: { padding: 16, borderRadius: APP_RADIUS.card, marginBottom: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dateText: { fontSize: 11, color: APP_COLORS.textMuted },
  courseTitle: { fontSize: 17, color: APP_COLORS.navyHeading, fontWeight: '800' },
  classText: { fontSize: 13, color: APP_COLORS.primary, marginTop: 2, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: APP_COLORS.textSecondary, marginRight: 8 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14, borderTopWidth: 1, borderTopColor: APP_COLORS.neutral200, paddingTop: 12 },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8, borderRadius: 8, backgroundColor: '#EFF6FF' },
  editText: { color: APP_COLORS.primary, fontSize: 12, fontWeight: '700' },
  deleteButton: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8, borderRadius: 8, backgroundColor: '#FEF2F2' },
  deleteText: { color: APP_COLORS.error, fontSize: 12, fontWeight: '700' },
  stateBox: { alignItems: 'center', padding: 26, backgroundColor: APP_COLORS.white, borderRadius: 14, gap: 9, marginBottom: 14 },
  stateText: { color: APP_COLORS.textSecondary, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  emptyTitle: { color: APP_COLORS.navyHeading, fontSize: 16, fontWeight: '800' },
  errorBox: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 10, marginBottom: 14 },
  errorText: { flex: 1, color: APP_COLORS.error, fontSize: 12, lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.58)', justifyContent: 'center', padding: 16 },
  modalCard: { maxHeight: '92%', borderRadius: 18, backgroundColor: APP_COLORS.white, padding: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { fontSize: 18, color: APP_COLORS.navyHeading, fontWeight: '800' },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: APP_COLORS.textSecondary, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: APP_COLORS.neutral200, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: APP_COLORS.navyHeading, backgroundColor: '#FFFFFF', fontSize: 13 },
  studentChoice: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 10, borderBottomWidth: 1, borderBottomColor: APP_COLORS.neutral100 },
  studentChoiceCopy: { flex: 1 },
  studentChoiceName: { fontSize: 13, color: APP_COLORS.navyHeading, fontWeight: '700' },
  studentChoiceMeta: { fontSize: 11, color: APP_COLORS.textMuted, marginTop: 2 },
  selectionHint: { fontSize: 11, color: APP_COLORS.textSecondary, marginTop: 10, marginBottom: 10 },
  saveButton: { backgroundColor: APP_COLORS.primary, borderRadius: 11, padding: 14, alignItems: 'center', marginTop: 6 },
  saveButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  disabledButton: { opacity: 0.6 },
});

export default ScheduleScreen;
