import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { useFirestoreSchedules } from '@/hooks/useFirestoreSchedules';
import { useRealtimeAttendance } from '@/hooks/useRealtimeAttendance';
import {
  submitPracticumAttendance,
  subscribeToStudentAttendanceForSchedule,
} from '@/services/attendanceService';
import type { AttendanceRecordItem } from '@/types/attendance';
import { FeedbackSection } from '@/components/FeedbackSection';
import { LeaveRequestSection } from '@/components/LeaveRequestSection';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { CustomButton } from '@/components/CustomButton';
import { AppHeader } from '@/components/AppHeader';
import { BottomNavigation } from '@/components/BottomNavigation';
import { DonutChart } from '@/components/DonutChart';
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

interface SessionDetailScreenProps {
  navigation: NavigationProp;
}

export const SessionDetailScreen: React.FC<SessionDetailScreenProps> = ({
  navigation,
}) => {
  const {
    activeScheduleId,
    activeRole,
    activeUser,
  } = useApp();
  const { schedules, loading: schedulesLoading, error: schedulesError } =
    useFirestoreSchedules(activeUser.id, activeRole);
  const targetScheduleId = navigation.params?.scheduleId || activeScheduleId;
  const currentSchedule =
    schedules.find(schedule => schedule.id === targetScheduleId) || schedules[0];

  // Presensi & statistik real-time dari Firestore
  const { stats } = useRealtimeAttendance(
    currentSchedule?.id,
    currentSchedule?.totalStudents ?? 0,
  );

  const attendanceSubKey =
    currentSchedule?.id && activeRole === 'student' && activeUser?.id
      ? `${currentSchedule.id}_${activeUser.id}`
      : '';
  const [attendanceState, setAttendanceState] = useState<{
    key: string;
    record: AttendanceRecordItem | null;
  }>({ key: '', record: null });
  const [submittingAttendance, setSubmittingAttendance] = useState<boolean>(false);

  useEffect(() => {
    if (!attendanceSubKey || !currentSchedule?.id || activeRole !== 'student' || !activeUser?.id) {
      return undefined;
    }
    const activeKey = attendanceSubKey;
    const unsubscribe = subscribeToStudentAttendanceForSchedule(
      currentSchedule.id,
      activeUser.id,
      record => setAttendanceState({ key: activeKey, record }),
      err => console.warn('Attendance listener error:', err),
    );
    return () => unsubscribe();
  }, [attendanceSubKey, currentSchedule?.id, activeUser?.id, activeRole]);

  const studentAttendance =
    attendanceSubKey && attendanceState.key === attendanceSubKey
      ? attendanceState.record
      : null;
  const isPresent = studentAttendance?.status === 'Hadir';
  const isExcused = studentAttendance?.status === 'Izin';
  const hasAttendanceRecord = isPresent || isExcused;

  const handleStudentAttendance = async () => {
    if (!currentSchedule) return;
    try {
      setSubmittingAttendance(true);
      const res = await submitPracticumAttendance({
        scheduleId: currentSchedule.id,
        studentId: activeUser.id,
        studentName: activeUser.name,
        nim: activeUser.nim,
      });
      Alert.alert('Presensi Berhasil!', res.message, [
        {
          text: 'OK',
          onPress: () => navigation.navigate('StudentHome'),
        },
      ]);
    } catch (err) {
      Alert.alert(
        'Presensi Gagal',
        err instanceof Error ? err.message : 'Presensi gagal dicatat ke Firestore.',
      );
    } finally {
      setSubmittingAttendance(false);
    }
  };

  if (schedulesLoading || schedulesError || !currentSchedule) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <AppHeader title="Detail Sesi" onBack={() => navigation.goBack()} />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            {schedulesLoading ? 'Memuat detail sesi...' : 'Detail sesi tidak tersedia'}
          </Text>
          <Text style={styles.emptyDescription}>
            {schedulesError || 'Jadwal tidak ditemukan atau akunmu tidak terdaftar sebagai peserta.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Academic Blue Header */}
      <AppHeader
        title="Detail Sesi"
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Main Session Banner Card */}
        {currentSchedule && (
          <Card style={styles.topCard}>
            <View style={styles.topCardRow}>
              <View style={styles.courseInfoGroup}>
                <Text style={styles.courseName}>{currentSchedule.courseName}</Text>
                <Text style={styles.courseMeta}>
                  {currentSchedule.date} • {currentSchedule.time}
                </Text>
              </View>
              <StatusBadge status={currentSchedule.status} size="sm" />
            </View>
          </Card>
        )}

        {/* Info Rows Cards */}
        {currentSchedule && (
          <View style={styles.infoSection}>
            {/* Ruang */}
            <Card style={styles.infoRowCard}>
              <View style={styles.infoRowContent}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="business" size={18} color={APP_COLORS.primary} />
                </View>
                <View style={styles.infoTextCol}>
                  <Text style={styles.infoLabel}>Ruang</Text>
                  <Text style={styles.infoValue}>{currentSchedule.room}</Text>
                </View>
              </View>
            </Card>

            {/* Dosen / Asisten */}
            <Card style={styles.infoRowCard}>
              <View style={styles.infoRowContent}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="person" size={18} color={APP_COLORS.primary} />
                </View>
                <View style={styles.infoTextCol}>
                  <Text style={styles.infoLabel}>
                    {activeRole === 'assistant' ? 'Asisten Pengampu' : 'Dosen / Asisten'}
                  </Text>
                  <Text style={styles.infoValue}>
                    {currentSchedule.assistantName || 'Pak Budi'}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Jumlah Mahasiswa */}
            <Card style={styles.infoRowCard}>
              <View style={styles.infoRowContent}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="people" size={18} color={APP_COLORS.primary} />
                </View>
                <View style={styles.infoTextCol}>
                  <Text style={styles.infoLabel}>Jumlah Mahasiswa</Text>
                  <Text style={styles.infoValue}>{stats.totalRegistered}</Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Persentase Kehadiran Section */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Persentase Kehadiran</Text>
          <Card style={styles.chartCard}>
            <DonutChart
              percentage={stats.attendancePercentage}
              hadir={stats.hadirCount}
              izin={stats.izinCount}
              alfa={stats.alfaCount}
            />
          </Card>
        </View>

        {/* Pengajuan Izin & Status Izin Real-time (Khusus Praktikan - Fritz) */}
        {activeRole === 'student' && currentSchedule && (
          <LeaveRequestSection
            scheduleId={currentSchedule.id}
            courseName={currentSchedule.courseName}
            className={currentSchedule.className}
            sessionStatus={currentSchedule.status}
            studentId={activeUser.id}
            studentName={activeUser.name}
            nim={activeUser.nim}
            isAttended={isPresent}
            onNavigateToLeaveScreen={() =>
              navigation.navigate('LeaveRequest', {
                scheduleId: currentSchedule.id,
              })
            }
          />
        )}

        {/* Status Kehadiran Praktikan (Hadir / Izin) */}
        {activeRole === 'student' && hasAttendanceRecord && studentAttendance && (
          <Card style={styles.attendanceStatusCard}>
            <View style={styles.attendanceStatusRow}>
              <Ionicons
                name={isPresent ? 'checkmark-circle' : 'document-text'}
                size={20}
                color={isPresent ? APP_COLORS.opened : APP_COLORS.warning}
              />
              <View style={styles.attendanceStatusTextCol}>
                <Text
                  style={[
                    styles.attendanceStatusTitle,
                    { color: isPresent ? APP_COLORS.opened : APP_COLORS.warning },
                  ]}>
                  {isPresent ? 'Anda Sudah Melakukan Presensi' : 'Status Kehadiran: Izin Disetujui'}
                </Text>
                <Text style={styles.attendanceStatusSub}>
                  {isPresent
                    ? `Tercatat Hadir pada ${studentAttendance.timestamp}`
                    : `Tercatat Izin pada ${studentAttendance.date} • ${studentAttendance.timestamp}`}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Form Pesan & Kesan setelah praktikum SELESAI (Khusus Praktikan) */}
        {activeRole === 'student' && currentSchedule && (
          <FeedbackSection
            scheduleId={currentSchedule.id}
            isSessionFinished={currentSchedule.status === 'SELESAI'}
            studentId={activeUser.id}
            studentName={activeUser.name}
          />
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          {activeRole === 'assistant' && (
            <CustomButton
              title="Lihat Daftar Mahasiswa"
              variant="primary"
              size="lg"
              onPress={() =>
                navigation.navigate('StudentList', {
                  scheduleId: currentSchedule?.id,
                })
              }
            />
          )}

          {/* If Assistant: button to Kontrol Sesi */}
          {activeRole === 'assistant' && (
            <CustomButton
              title="Buka / Kontrol Sesi"
              variant="secondary"
              size="lg"
              style={styles.extraBtn}
              onPress={() =>
                navigation.navigate('SessionControl', {
                  scheduleId: currentSchedule?.id,
                })
              }
            />
          )}

          {/* If Assistant: button to Pemeriksaan Izin (Fritz) */}
          {activeRole === 'assistant' && (
            <CustomButton
              title="Periksa Pengajuan Izin (AI)"
              variant="outline"
              size="lg"
              style={styles.extraBtn}
              onPress={() =>
                navigation.navigate('LeaveApproval', {
                  scheduleId: currentSchedule?.id,
                })
              }
            />
          )}

          {/* If Student & Session Open & not attended: Presensi Sekarang */}
          {activeRole === 'student' && currentSchedule?.status === 'DIBUKA' && !hasAttendanceRecord && (
            <CustomButton
              title={submittingAttendance ? 'Mencatat Kehadiran...' : 'Presensi Sekarang'}
              variant="primary"
              size="lg"
              disabled={submittingAttendance}
              style={styles.extraBtn}
              leftIcon={
                submittingAttendance ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : undefined
              }
              onPress={handleStudentAttendance}
            />
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavigation
        role={activeRole}
        activeTab="ScheduleList"
        onTabChange={(tabKey) => navigation.navigate(tabKey)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: APP_SPACING.lg,
    paddingTop: APP_SPACING.md,
    paddingBottom: APP_SPACING.xl,
  },
  topCard: {
    padding: APP_SPACING.lg,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.md,
  },
  topCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  courseInfoGroup: {
    flex: 1,
    paddingRight: APP_SPACING.sm,
  },
  courseName: {
    fontSize: 17,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
    marginBottom: 4,
  },
  courseMeta: {
    fontSize: 13,
    color: APP_COLORS.textSecondary,
  },
  infoSection: {
    gap: APP_SPACING.sm,
    marginBottom: APP_SPACING.lg,
  },
  infoRowCard: {
    padding: APP_SPACING.md,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  infoRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: APP_COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_SPACING.md,
  },
  infoTextCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
  },
  statsSection: {
    marginBottom: APP_SPACING.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
    marginBottom: APP_SPACING.sm,
  },
  chartCard: {
    borderRadius: APP_RADIUS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    padding: APP_SPACING.xs,
  },
  actionButtonsContainer: {
    gap: APP_SPACING.sm,
    marginTop: APP_SPACING.sm,
  },
  extraBtn: {
    marginTop: 2,
  },
  attendanceStatusCard: {
    padding: APP_SPACING.md,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.md,
  },
  attendanceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_SPACING.sm,
  },
  attendanceStatusTextCol: {
    flex: 1,
  },
  attendanceStatusTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  attendanceStatusSub: {
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: APP_SPACING.xl,
  },
  emptyTitle: {
    color: APP_COLORS.navyHeading,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyDescription: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default SessionDetailScreen;
