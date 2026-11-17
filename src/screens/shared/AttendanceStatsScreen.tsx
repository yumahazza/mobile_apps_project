import React from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { useFirestoreSchedules } from '@/hooks/useFirestoreSchedules';
import { useRealtimeAttendance } from '@/hooks/useRealtimeAttendance';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { AppHeader } from '@/components/AppHeader';
import { BottomNavigation } from '@/components/BottomNavigation';
import { DonutChart } from '@/components/DonutChart';
import { NavigationProp } from '@/navigation/navigationTypes';
import type { PracticumSchedule } from '@/services/practicumScheduleService';
import {
  APP_COLORS,
  APP_FONTS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

interface AttendanceStatsScreenProps {
  navigation: NavigationProp;
}

const SessionProgressItem: React.FC<{ schedule: PracticumSchedule }> = ({
  schedule,
}) => {
  const { stats } = useRealtimeAttendance(
    schedule.id,
    schedule.totalStudents ?? 0,
  );

  return (
    <Card style={styles.barCard}>
      <View style={styles.barLabelRow}>
        <Text style={styles.barCourseName} numberOfLines={1}>
          {schedule.courseName}
        </Text>
        <Text style={styles.barPercentText}>{stats.attendancePercentage}%</Text>
      </View>
      <View style={styles.progressBarTrack}>
        <View
          style={[
            styles.progressBarFill,
            {
              width: `${Math.max(
                0,
                Math.min(100, stats.attendancePercentage),
              )}%`,
            },
          ]}
        />
      </View>
      <Text style={styles.barDetailsText}>
        {stats.hadirCount} hadir · {stats.izinCount} izin · {stats.alfaCount} alfa
      </Text>
    </Card>
  );
};

export const AttendanceStatsScreen: React.FC<AttendanceStatsScreenProps> = ({
  navigation,
}) => {
  const {
    activeScheduleId,
    activeRole,
    activeUser,
  } = useApp();

  const {
    schedules,
    loading: schedulesLoading,
    error: schedulesError,
  } = useFirestoreSchedules(activeUser.id, activeRole);

  const currentSchedule =
    schedules.find((s) => s.id === navigation.params?.scheduleId) ||
    schedules.find((s) => s.id === activeScheduleId) ||
    schedules[0];

  const { stats } = useRealtimeAttendance(
    currentSchedule?.id,
    currentSchedule?.totalStudents ?? 0,
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title="Statistik Kehadiran"
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {schedulesLoading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color={APP_COLORS.primary} />
            <Text style={styles.stateText}>Memuat statistik...</Text>
          </View>
        ) : schedulesError ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Gagal Memuat Statistik"
            description={schedulesError}
          />
        ) : !currentSchedule ? (
          <EmptyState
            icon="stats-chart-outline"
            title="Belum Ada Statistik"
            description="Statistik muncul setelah ada jadwal praktikum."
          />
        ) : (
          <>
            <Card style={styles.sessionCard}>
              <View style={styles.sessionRow}>
                <View style={styles.iconBox}>
                  <Ionicons name="stats-chart" size={18} color={APP_COLORS.primary} />
                </View>
                <View style={styles.sessionTextCol}>
                  <Text style={styles.courseName}>{currentSchedule.courseName}</Text>
                  <Text style={styles.sessionMeta}>
                    {currentSchedule.time} · {currentSchedule.room}
                  </Text>
                </View>
              </View>
            </Card>

            <Card style={styles.chartCard}>
              <DonutChart
                percentage={stats.attendancePercentage}
                hadir={stats.hadirCount}
                izin={stats.izinCount}
                alfa={stats.alfaCount}
              />
            </Card>

            <View style={styles.perSessionSection}>
              <Text style={styles.sectionTitle}>Per Sesi</Text>

              <View style={styles.barsList}>
                {schedules.map((schedule) => (
                  <SessionProgressItem key={schedule.id} schedule={schedule} />
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <BottomNavigation
        role={activeRole}
        activeTab="SessionRecap"
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
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: APP_SPACING.xxxl,
    gap: APP_SPACING.sm,
  },
  stateText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
  },
  sessionCard: {
    padding: APP_SPACING.lg,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.md,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: APP_COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_SPACING.md,
  },
  sessionTextCol: {
    flex: 1,
  },
  courseName: {
    fontFamily: APP_FONTS.bold,
    fontSize: 15,
    color: APP_COLORS.inkPrimary,
    marginBottom: 2,
  },
  sessionMeta: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  chartCard: {
    borderRadius: APP_RADIUS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    padding: APP_SPACING.xs,
    marginBottom: APP_SPACING.lg,
  },
  perSessionSection: {
    marginBottom: APP_SPACING.md,
  },
  sectionTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 16,
    color: APP_COLORS.inkPrimary,
    marginBottom: APP_SPACING.sm,
  },
  barsList: {
    gap: APP_SPACING.sm,
  },
  barCard: {
    padding: APP_SPACING.lg,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  barLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  barCourseName: {
    flex: 1,
    fontFamily: APP_FONTS.semiBold,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
  },
  barPercentText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 13,
    color: APP_COLORS.primary,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: APP_COLORS.neutral100,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: APP_COLORS.primary,
    borderRadius: 4,
  },
  barDetailsText: {
    marginTop: 6,
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
});

export default AttendanceStatsScreen;
