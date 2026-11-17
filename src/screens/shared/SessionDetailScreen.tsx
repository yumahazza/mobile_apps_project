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
import { EmptyState } from '@/components/EmptyState';
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
  APP_FONTS,
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
    schedules.find((schedule) => schedule.id === targetScheduleId) || schedules[0];

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
    if (
      !attendanceSubKey ||
      !currentSchedule?.id ||
      activeRole !== 'student' ||
      !activeUser?.id
    ) {
      return undefined;
    }
    const activeKey = attendanceSubKey;
    const unsubscribe = subscribeToStudentAttendanceForSchedule(
      currentSchedule.id,
      activeUser.id,
      (record) => setAttendanceState({ key: activeKey, record }),
      (err) => console.warn('Attendance listener error:', err),
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
      Alert.alert('Presensi Berhasil', res.message, [
        {
          text: 'OK',
          onPress: () => navigation.navigate('StudentHome'),
        },
      ]);
    } catch (err) {
      Alert.alert(
        'Presensi Gagal',
        err instanceof Error ? err.message : 'Presensi gagal dicatat.',
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
          <EmptyState
            icon="calendar-outline"
            title={
              schedulesLoading
                ? 'Memuat Detail Sesi'
                : 'Detail Sesi Tidak Tersedia'
            }
            description={
              schedulesError ||
              'Jadwal tidak ditemukan atau akun Anda belum terdaftar.'
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title="Detail Sesi"
        subtitle={`${currentSchedule.courseName} · ${currentSchedule.className}`}
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Hero Session Banner (#273287 + #D8E63C) */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.classPill}>
              <Text style={styles.classPillText}>
                {currentSchedule.className}
              </Text>
            </View>
            <StatusBadge status={currentSchedule.status} size="sm" />
          </View>
          <Text style={styles.courseName}>{currentSchedule.courseName}</Text>
          <Text style={styles.courseMeta}>
            {currentSchedule.date} · {currentSchedule.time}
          </Text>
        </View>

        {/* Info dalam 1 Panel Putih Bersekat Tipis */}
        <View style={styles.infoPanel}>
          <View style={[styles.infoRow, styles.infoRowDivider]}>
            <View style={styles.infoIconBox}>
              <Ionicons name="business-outline" size={18} color={APP_COLORS.primary} />
            </View>
            <View style={styles.infoTextCol}>
              <Text style={styles.infoLabel}>Ruang</Text>
              <Text style={styles.infoValue}>{currentSchedule.room}</Text>
            </View>
          </View>

          <View style={[styles.infoRow, styles.infoRowDivider]}>
            <View style={styles.infoIconBox}>
              <Ionicons name="person-outline" size={18} color={APP_COLORS.primary} />
            </View>
            <View style={styles.infoTextCol}>
              <Text style={styles.infoLabel}>
                {activeRole === 'assistant' ? 'Asisten' : 'Asisten Pengampu'}
              </Text>
              <Text style={styles.infoValue}>
                {currentSchedule.assistantName || '-'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconBox}>
              <Ionicons name="people-outline" size={18} color={APP_COLORS.primary} />
            </View>
            <View style={styles.infoTextCol}>
              <Text style={styles.infoLabel}>Jumlah Peserta</Text>
              <Text style={styles.infoValue}>{stats.totalRegistered}</Text>
            </View>
          </View>
        </View>

        {/* Persentase Kehadiran */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Kehadiran Sesi</Text>
          <Card style={styles.chartCard}>
            <DonutChart
              percentage={stats.attendancePercentage}
              hadir={stats.hadirCount}
              izin={stats.izinCount}
              alfa={stats.alfaCount}
            />
          </Card>
        </View>

        {/* Pengajuan Izin (Praktikan) */}
        {activeRole === 'student' && (
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

        {/* Status Kehadiran Praktikan */}
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
                  {isPresent ? 'Tercatat Hadir' : 'Tercatat Izin'}
                </Text>
                <Text style={styles.attendanceStatusSub}>
                  {studentAttendance.date} · {studentAttendance.timestamp}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Pesan & Kesan (Praktikan) */}
        {activeRole === 'student' && (
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
            <>
              <CustomButton
                title="Daftar Mahasiswa"
                variant="primary"
                size="lg"
                onPress={() =>
                  navigation.navigate('StudentList', {
                    scheduleId: currentSchedule.id,
                  })
                }
              />
              <CustomButton
                title="Kontrol Sesi"
                variant="secondary"
                size="lg"
                onPress={() =>
                  navigation.navigate('SessionControl', {
                    scheduleId: currentSchedule.id,
                  })
                }
              />
              <CustomButton
                title="Review Pengajuan Izin"
                variant="outline"
                size="lg"
                onPress={() =>
                  navigation.navigate('LeaveApproval', {
                    scheduleId: currentSchedule.id,
                  })
                }
              />
            </>
          )}

          {activeRole === 'student' &&
            currentSchedule.status === 'DIBUKA' &&
            !hasAttendanceRecord && (
              <CustomButton
                title={submittingAttendance ? 'Mencatat...' : 'Presensi Sekarang'}
                variant="primary"
                size="lg"
                disabled={submittingAttendance}
                leftIcon={
                  submittingAttendance ? (
                    <ActivityIndicator size="small" color={APP_COLORS.white} />
                  ) : undefined
                }
                onPress={handleStudentAttendance}
              />
            )}
        </View>
      </ScrollView>

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
    paddingTop: APP_SPACING.xs,
    paddingBottom: APP_SPACING.xxl,
  },
  heroCard: {
    padding: APP_SPACING.xl,
    borderRadius: APP_RADIUS.hero,
    backgroundColor: APP_COLORS.intergalactic,
    marginBottom: APP_SPACING.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: APP_SPACING.md,
  },
  classPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: APP_RADIUS.pill,
  },
  classPillText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.white,
  },
  courseName: {
    fontFamily: APP_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
    color: APP_COLORS.durantaYellow,
    marginBottom: 4,
  },
  courseMeta: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.88)',
  },
  infoPanel: {
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.lg,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: APP_SPACING.lg,
  },
  infoRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.divider,
  },
  infoIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: APP_COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_SPACING.md,
  },
  infoTextCol: {
    flex: 1,
  },
  infoLabel: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  infoValue: {
    fontFamily: APP_FONTS.bold,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
    marginTop: 1,
  },
  statsSection: {
    marginBottom: APP_SPACING.lg,
  },
  sectionTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 16,
    color: APP_COLORS.inkPrimary,
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
    marginTop: APP_SPACING.xs,
  },
  attendanceStatusCard: {
    padding: APP_SPACING.lg,
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
    fontFamily: APP_FONTS.bold,
    fontSize: 14,
  },
  attendanceStatusSub: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    padding: APP_SPACING.lg,
  },
});

export default SessionDetailScreen;
