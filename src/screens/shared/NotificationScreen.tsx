import React, { useEffect, useMemo, useState } from 'react';
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
import { useStudentLeaveRequests } from '@/hooks/useRealtimeLeaveRequests';
import { useStudentAttendanceHistory } from '@/hooks/useStudentAttendanceHistory';
import { subscribeToScheduleLeaveRequests } from '@/services/leaveRequestService';
import type { LeaveRequestItem } from '@/types/leaveRequest';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { AppHeader } from '@/components/AppHeader';
import { BottomNavigation } from '@/components/BottomNavigation';
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

interface NotificationScreenProps {
  navigation: NavigationProp;
}

interface NotificationItem {
  id: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconBgColor: string;
  iconColor: string;
  title: string;
  message: string;
  meta: string;
  onPress: () => void;
}

export const NotificationScreen: React.FC<NotificationScreenProps> = ({
  navigation,
}) => {
  const { activeRole, activeUser, setActiveScheduleId } = useApp();

  const {
    schedules,
    loading: schedulesLoading,
    error: schedulesError,
  } = useFirestoreSchedules(activeUser.id, activeRole);

  const isStudent = activeRole === 'student';

  const {
    leaveRequests: studentLeaves,
    loading: studentLeavesLoading,
  } = useStudentLeaveRequests(isStudent ? activeUser.id : undefined);

  const {
    historyRecords,
    loading: historyLoading,
  } = useStudentAttendanceHistory(isStudent ? activeUser.id : undefined);

  const [assistantLeavesBySchedule, setAssistantLeavesBySchedule] = useState<
    Record<string, LeaveRequestItem[]>
  >({});

  const scheduleIdsKey = !isStudent
    ? schedules.map((schedule) => schedule.id).join('|')
    : '';

  useEffect(() => {
    if (!scheduleIdsKey) {
      return undefined;
    }

    const scheduleIds = scheduleIdsKey.split('|').filter(Boolean);
    const unsubscribes = scheduleIds.map((scheduleId) =>
      subscribeToScheduleLeaveRequests(
        scheduleId,
        (items) => {
          setAssistantLeavesBySchedule((prev) => ({
            ...prev,
            [scheduleId]: items,
          }));
        },
        () => {
          // Abaikan error per jadwal agar notifikasi jadwal lain tetap tampil.
        },
      ),
    );

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [scheduleIdsKey]);

  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];

    if (!isStudent) {
      schedules.forEach((schedule) => {
        const leaves = assistantLeavesBySchedule[schedule.id] ?? [];
        leaves
          .filter((req) => req.status === 'MENUNGGU')
          .forEach((req) => {
            items.push({
              id: `leave-pending-${req.id}`,
              iconName: 'document-text',
              iconBgColor: '#FEF3C7',
              iconColor: '#D97706',
              title: 'Pengajuan Izin Menunggu',
              message: `${req.studentName} (${schedule.courseName}) • AI: ${req.aiClassification}`,
              meta: req.createdAt,
              onPress: () => {
                setActiveScheduleId(schedule.id);
                navigation.navigate('LeaveApproval', { scheduleId: schedule.id });
              },
            });
          });
      });

      schedules
        .filter((s) => s.status === 'DIBUKA')
        .forEach((s) => {
          items.push({
            id: `open-${s.id}`,
            iconName: 'radio',
            iconBgColor: '#DCFCE7',
            iconColor: '#16A34A',
            title: 'Sesi Sedang Berlangsung',
            message: `${s.courseName} (${s.className}) sedang dibuka di ${s.room}.`,
            meta: `${s.date} • ${s.time}`,
            onPress: () => {
              setActiveScheduleId(s.id);
              navigation.navigate('SessionControl', { scheduleId: s.id });
            },
          });
        });

      schedules
        .filter((s) => s.status === 'BELUM_DIBUKA')
        .forEach((s) => {
          items.push({
            id: `upcoming-${s.id}`,
            iconName: 'calendar',
            iconBgColor: APP_COLORS.softBlue,
            iconColor: APP_COLORS.primary,
            title: 'Jadwal Menunggu Dibuka',
            message: `${s.courseName} (${s.className}) di ${s.room}.`,
            meta: `${s.date} • ${s.time}`,
            onPress: () => {
              setActiveScheduleId(s.id);
              navigation.navigate('SessionControl', { scheduleId: s.id });
            },
          });
        });

      schedules
        .filter((s) => s.status === 'SELESAI')
        .slice(0, 5)
        .forEach((s) => {
          items.push({
            id: `recap-${s.id}`,
            iconName: 'stats-chart',
            iconBgColor: '#F1F5F9',
            iconColor: '#475569',
            title: 'Rekap & Sentimen Sesi Tersedia',
            message: `${s.courseName} (${s.className}) telah selesai.`,
            meta: `${s.date} • ${s.time}`,
            onPress: () => {
              setActiveScheduleId(s.id);
              navigation.navigate('SessionRecap', { scheduleId: s.id });
            },
          });
        });

      return items;
    }

    const attendedScheduleIds = new Set(historyRecords.map((r) => r.scheduleId));

    schedules
      .filter((s) => s.status === 'DIBUKA' && !attendedScheduleIds.has(s.id))
      .forEach((s) => {
        items.push({
          id: `stu-open-${s.id}`,
          iconName: 'notifications',
          iconBgColor: '#DCFCE7',
          iconColor: '#16A34A',
          title: 'Presensi Sedang Dibuka',
          message: `${s.courseName} (${s.className}) di ${s.room} membuka presensi sekarang.`,
          meta: `${s.date} • ${s.time}`,
          onPress: () => {
            setActiveScheduleId(s.id);
            navigation.navigate('SessionDetail', { scheduleId: s.id });
          },
        });
      });

    studentLeaves.forEach((req) => {
      const isApproved = req.status === 'DITERIMA';
      const isRejected = req.status === 'DITOLAK';
      items.push({
        id: `stu-leave-${req.id}`,
        iconName: isApproved
          ? 'checkmark-circle'
          : isRejected
          ? 'close-circle'
          : 'time',
        iconBgColor: isApproved
          ? '#DCFCE7'
          : isRejected
          ? '#FEE2E2'
          : '#FEF3C7',
        iconColor: isApproved
          ? '#16A34A'
          : isRejected
          ? '#DC2626'
          : '#D97706',
        title: isApproved
          ? 'Pengajuan Izin Diterima'
          : isRejected
          ? 'Pengajuan Izin Ditolak'
          : 'Pengajuan Izin Menunggu',
        message: `${req.courseName || 'Praktikum'} • AI: ${req.aiClassification}`,
        meta: req.reviewedAt || req.createdAt,
        onPress: () => {
          setActiveScheduleId(req.scheduleId);
          navigation.navigate('LeaveRequest', { scheduleId: req.scheduleId });
        },
      });
    });

    schedules
      .filter((s) => s.status === 'SELESAI')
      .slice(0, 5)
      .forEach((s) => {
        items.push({
          id: `stu-finished-${s.id}`,
          iconName: 'chatbubbles',
          iconBgColor: APP_COLORS.softBlue,
          iconColor: APP_COLORS.primary,
          title: 'Sesi Selesai — Pesan & Kesan',
          message: `${s.courseName} (${s.className}) telah selesai. Anda dapat mengisi ulasan.`,
          meta: `${s.date} • ${s.time}`,
          onPress: () => {
            setActiveScheduleId(s.id);
            navigation.navigate('SessionDetail', { scheduleId: s.id });
          },
        });
      });

    historyRecords.slice(0, 5).forEach((rec) => {
      const matchedSchedule = schedules.find((s) => s.id === rec.scheduleId);
      items.push({
        id: `stu-att-${rec.id}`,
        iconName: rec.status === 'Izin' ? 'document-text' : 'shield-checkmark',
        iconBgColor: rec.status === 'Izin' ? '#FEF3C7' : '#DCFCE7',
        iconColor: rec.status === 'Izin' ? '#D97706' : '#16A34A',
        title: `Kehadiran Tercatat (${rec.status})`,
        message: `${matchedSchedule?.courseName || 'Praktikum'} • ${rec.timestamp}`,
        meta: rec.date,
        onPress: () => {
          navigation.navigate('AttendanceDetail', {
            record: rec,
            schedule: matchedSchedule,
          });
        },
      });
    });

    schedules
      .filter((s) => s.status === 'BELUM_DIBUKA')
      .forEach((s) => {
        items.push({
          id: `stu-upcoming-${s.id}`,
          iconName: 'calendar',
          iconBgColor: APP_COLORS.softBlue,
          iconColor: APP_COLORS.primary,
          title: 'Jadwal Praktikum Terdaftar',
          message: `${s.courseName} (${s.className}) di ${s.room}.`,
          meta: `${s.date} • ${s.time}`,
          onPress: () => {
            setActiveScheduleId(s.id);
            navigation.navigate('SessionDetail', { scheduleId: s.id });
          },
        });
      });

    return items;
  }, [
    isStudent,
    schedules,
    assistantLeavesBySchedule,
    historyRecords,
    studentLeaves,
    navigation,
    setActiveScheduleId,
  ]);

  const isLoading =
    schedulesLoading || (isStudent && (studentLeavesLoading || historyLoading));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Academic Blue Header */}
      <AppHeader
        title="Notifikasi"
        onBack={() => navigation.goBack()}
        hasUnreadNotifications={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={APP_COLORS.primary} />
            <Text style={styles.stateText}>Memuat aktivitas terbaru...</Text>
          </View>
        ) : schedulesError ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Gagal Memuat Notifikasi"
            description={schedulesError}
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon="notifications-off-outline"
            title="Belum Ada Aktivitas"
            description="Notifikasi sesi praktikum, presensi, dan status pengajuan izin secara real-time akan tampil di sini."
          />
        ) : (
          <View style={styles.listContainer}>
            {notifications.map((item) => (
              <Card
                key={item.id}
                onPress={item.onPress}
                style={styles.notifCard}>
                <View style={styles.notifRow}>
                  <View
                    style={[
                      styles.iconBox,
                      { backgroundColor: item.iconBgColor },
                    ]}>
                    <Ionicons
                      name={item.iconName}
                      size={20}
                      color={item.iconColor}
                    />
                  </View>
                  <View style={styles.textContent}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    <Text style={styles.notifMessage} numberOfLines={2}>
                      {item.message}
                    </Text>
                    <Text style={styles.notifTime}>{item.meta}</Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={APP_COLORS.neutral400}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavigation
        role={activeRole}
        activeTab={activeRole === 'assistant' ? 'AssistantHome' : 'StudentHome'}
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
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: APP_SPACING.xxxl,
    gap: APP_SPACING.sm,
  },
  stateText: {
    fontSize: 13,
    color: APP_COLORS.textSecondary,
  },
  listContainer: {
    gap: APP_SPACING.sm,
  },
  notifCard: {
    padding: APP_SPACING.md,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_SPACING.md,
  },
  textContent: {
    flex: 1,
    paddingRight: APP_SPACING.sm,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
    marginBottom: 2,
  },
  notifMessage: {
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    lineHeight: 16,
    marginBottom: 4,
  },
  notifTime: {
    fontSize: 11,
    color: APP_COLORS.textMuted,
  },
});

export default NotificationScreen;
