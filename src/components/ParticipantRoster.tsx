import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_COLORS } from '@/constants/theme';
import {
  getStudentDirectory,
  PracticumSchedule,
  StudentOption,
  updatePracticumParticipants,
} from '@/services/practicumScheduleService';

interface ParticipantRosterProps {
  schedule: PracticumSchedule;
}

export const ParticipantRoster: React.FC<ParticipantRosterProps> = ({ schedule }) => {
  const enrolledKey = `${schedule.id}:${schedule.enrolledStudents.join('|')}`;
  const [prevEnrolledKey, setPrevEnrolledKey] = useState(enrolledKey);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selected, setSelected] = useState<string[]>(schedule.enrolledStudents);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  if (prevEnrolledKey !== enrolledKey) {
    setPrevEnrolledKey(enrolledKey);
    setSelected(schedule.enrolledStudents);
  }

  useEffect(() => {
    let active = true;
    getStudentDirectory()
      .then(list => { if (active) setStudents(list); })
      .catch(error => Alert.alert('Daftar praktikan gagal dimuat', error.message || 'Periksa akses collection users.'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const toggle = (uid: string) => {
    setSelected(previous =>
      previous.includes(uid) ? previous.filter(id => id !== uid) : [...previous, uid],
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      await updatePracticumParticipants(schedule.id, selected);
      Alert.alert('Peserta diperbarui', `${selected.length} praktikan terdaftar pada jadwal ini.`);
    } catch (error) {
      Alert.alert('Gagal menyimpan peserta', error instanceof Error ? error.message : 'Periksa Firestore Rules.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Peserta Terdaftar</Text>
          <Text style={styles.caption}>{selected.length} UID praktikan pada jadwal ini</Text>
        </View>
        <Ionicons name="people-outline" size={22} color={APP_COLORS.primary} />
      </View>

      {loading ? (
        <ActivityIndicator color={APP_COLORS.primary} />
      ) : students.length === 0 ? (
        <Text style={styles.empty}>Belum ada akun dengan role student di collection users.</Text>
      ) : (
        students.map(student => {
          const active = selected.includes(student.uid);
          return (
            <Pressable key={student.uid} style={styles.row} onPress={() => toggle(student.uid)}>
              <Ionicons
                name={active ? 'checkbox' : 'square-outline'}
                size={20}
                color={active ? APP_COLORS.primary : APP_COLORS.neutral400}
              />
              <View style={styles.copy}>
                <Text style={styles.name}>{student.name}</Text>
                <Text style={styles.meta}>{student.nim || student.email || student.uid}</Text>
              </View>
            </Pressable>
          );
        })
      )}

      <Pressable style={[styles.save, saving && styles.disabled]} disabled={saving || loading} onPress={save}>
        {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Simpan Daftar Peserta</Text>}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: APP_COLORS.neutral200 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  title: { color: APP_COLORS.navyHeading, fontWeight: '800', fontSize: 14 },
  caption: { color: APP_COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, borderTopWidth: 1, borderTopColor: APP_COLORS.neutral100 },
  copy: { flex: 1 },
  name: { color: APP_COLORS.navyHeading, fontSize: 13, fontWeight: '700' },
  meta: { color: APP_COLORS.textMuted, fontSize: 11, marginTop: 2 },
  empty: { color: APP_COLORS.textSecondary, fontSize: 12, paddingVertical: 8 },
  save: { marginTop: 8, backgroundColor: APP_COLORS.primary, padding: 12, borderRadius: 10, alignItems: 'center' },
  saveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  disabled: { opacity: 0.55 },
});
