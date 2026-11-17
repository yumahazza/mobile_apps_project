import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_COLORS, APP_FONTS, APP_RADIUS, APP_SPACING } from '@/constants/theme';
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
      Alert.alert('Peserta diperbarui', `${selected.length} praktikan terdaftar.`);
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
          <Text style={styles.caption}>{selected.length} praktikan dipilih</Text>
        </View>
        <Ionicons name="people-outline" size={20} color={APP_COLORS.primary} />
      </View>

      {loading ? (
        <ActivityIndicator color={APP_COLORS.primary} />
      ) : students.length === 0 ? (
        <Text style={styles.empty}>Belum ada akun praktikan terdaftar.</Text>
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

      <Pressable
        style={({ pressed }) => [
          styles.save,
          saving && styles.disabled,
          pressed && styles.pressed,
        ]}
        disabled={saving || loading}
        onPress={save}>
        {saving ? (
          <ActivityIndicator color={APP_COLORS.white} />
        ) : (
          <Text style={styles.saveText}>Simpan Daftar Peserta</Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.card,
    padding: APP_SPACING.lg,
    marginBottom: APP_SPACING.md,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontFamily: APP_FONTS.bold,
    color: APP_COLORS.inkPrimary,
    fontSize: 15,
  },
  caption: {
    fontFamily: APP_FONTS.medium,
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: APP_COLORS.divider,
  },
  copy: {
    flex: 1,
  },
  name: {
    fontFamily: APP_FONTS.semiBold,
    color: APP_COLORS.inkPrimary,
    fontSize: 14,
  },
  meta: {
    fontFamily: APP_FONTS.regular,
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  empty: {
    fontFamily: APP_FONTS.regular,
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    paddingVertical: 8,
  },
  save: {
    marginTop: 12,
    minHeight: 44,
    backgroundColor: APP_COLORS.primary,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: APP_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontFamily: APP_FONTS.bold,
    color: APP_COLORS.white,
    fontSize: 13,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.82,
  },
});
