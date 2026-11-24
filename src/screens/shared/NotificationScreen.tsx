import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
import { useUserNotifications } from '@/hooks/useUserNotifications';
import { subscribeToScheduleLeaveRequests } from '@/services/leaveRequestService';
import { markNotificationAsRead } from '@/services/notificationHistoryService';
import { resolveNotificationNavigation } from '@/services/notificationTriggerRules';
import { openAppNotificationSettings } from '@/services/pushNotificationService';
import type { LeaveRequestItem } from '@/types/leaveRequest';
import type { NotificationType } from '@/types/notification';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { AppHeader } from '@/components/AppHeader';
import { BottomNavigation } from '@/components/BottomNavigation';
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
  APP_FONTS,
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
  unread?: boolean;
  onPress: () => void;
}

function getPushNotificationStyle(type: NotificationType): {
  iconName: keyof typeof Ionicons.glyphMap;
  iconBgColor: string;
  iconColor: string;
} {
  switch (type) {
    case 'SESSION_OPENED':
      return {
        iconName: 'notifications-outline',
        iconBgColor: APP_COLORS.openedSoft,
        iconColor: APP_COLORS.opened,
      };
    case 'SCHEDULE_UPDATED':
      return {
        iconName: 'calendar-outline',
        iconBgColor: APP_COLORS.softBlue,
        iconColor: APP_COLORS.primary,
      };
    case 'LEAVE_APPROVED':
      return {
        iconName: 'checkmark-circle-outline',
        iconBgColor: APP_COLORS.openedSoft,
        iconColor: APP_COLORS.opened,
      };
    case 'LEAVE_REJECTED':
      return {
        iconName: 'close-circle-outline',
        iconBgColor: APP_COLORS.dangerSoft,
        iconColor: APP_COLORS.dangerText,
      };
  }
}

export const NotificationScreen: React.FC<NotificationScreenProps> = ({
  navigation,
}) => {
  const {
    activeRole,
    activeUser,
    isAuthenticated,
    setActiveScheduleId,
    pushRegistration,
    refreshPushRegistration,
  } = useApp();

  const {
    notifications: storedNotifications,
    unreadCount,
    loading: storedNotifLoading,
  } = useUserNotifications(isAuthenticated ? activeUser.id : undefined);

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
          // Abaikan error per jadwal agar notifikasi lain tetap tampil.
        },
      ),
    );

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [scheduleIdsKey]);

  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];

    // 1. Riwayat push notification otomatis dari koleksi `notifications` Firestore
    storedNotifications.forEach((entry) => {
      const styleMeta = getPushNotificationStyle(entry.type);
      items.push({
        id: `push-${entry.id}`,
        iconName: styleMeta.iconName,
        iconBgColor: styleMeta.iconBgColor,
        iconColor: styleMeta.iconColor,
        title: entry.title,
        message: entry.body,
        meta: entry.createdAt,
        unread: !entry.readAt,
        onPress: () => {
          if (!entry.readAt) {
            void markNotificationAsRead(entry.id);
          }
          const target = resolveNotificationNavigation(
            {
              type: entry.type,
              relatedId: entry.relatedId,
              scheduleId: entry.relatedId,
            },
            activeRole,
          );
          if (target.params?.scheduleId) {
            setActiveScheduleId(target.params.scheduleId);
          }
          if (target.screen !== 'Notifications') {
            navigation.navigate(target.screen, target.params);
          }
        },
      });
    });

    if (!isStudent) {
      schedules.forEach((schedule) => {
        const leaves = assistantLeavesBySchedule[schedule.id] ?? [];
        leaves
          .filter((req) => req.status === 'MENUNGGU')
          .forEach((req) => {
            items.push({
              id: `leave-pending-${req.id}`,
              iconName: 'document-text-outline',
              iconBgColor: APP_COLORS.notOpenedSoft,
              iconColor: APP_COLORS.notOpened,
              title: 'Pengajuan Izin Menunggu',
              message: `${req.studentName} · ${schedule.courseName} (${schedule.className})`,
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
            iconName: 'radio-outline',
            iconBgColor: APP_COLORS.openedSoft,
            iconColor: APP_COLORS.opened,
            title: 'Sesi Sedang Dibuka',
            message: `${s.courseName} (${s.className}) · ${s.room}`,
            meta: `${s.date} · ${s.time}`,
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
            iconName: 'calendar-outline',
            iconBgColor: APP_COLORS.softBlue,
            iconColor: APP_COLORS.primary,
            title: 'Jadwal Menunggu Dibuka',
            message: `${s.courseName} (${s.className}) · ${s.room}`,
            meta: `${s.date} · ${s.time}`,
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
            iconName: 'stats-chart-outline',
            iconBgColor: APP_COLORS.finishedSoft,
            iconColor: APP_COLORS.finished,
            title: 'Rekap & Ulasan Tersedia',
            message: `${s.courseName} (${s.className})`,
            meta: `${s.date} · ${s.time}`,
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
          iconName: 'notifications-outline',
          iconBgColor: APP_COLORS.openedSoft,
          iconColor: APP_COLORS.opened,
          title: 'Presensi Dibuka',
          message: `${s.courseName} (${s.className}) · ${s.room}`,
          meta: `${s.date} · ${s.time}`,
          onPress: () => {
            setActiveScheduleId(s.id);
            navigation.navigate('SessionDetail', { scheduleId: s.id });
          },
        });
      });

    studentLeaves.forEach((req) => {
      const matchedSchedule = schedules.find((s) => s.id === req.scheduleId);
      const courseLabel =
        matchedSchedule?.courseName || req.courseName || 'Praktikum';
      const classLabel = matchedSchedule?.className || req.className || '';
      const isApproved = req.status === 'DITERIMA';
      const isRejected = req.status === 'DITOLAK';

      items.push({
        id: `stu-leave-${req.id}`,
        iconName: isApproved
          ? 'checkmark-circle-outline'
          : isRejected
          ? 'close-circle-outline'
          : 'time-outline',
        iconBgColor: isApproved
          ? APP_COLORS.openedSoft
          : isRejected
          ? APP_COLORS.dangerSoft
          : APP_COLORS.notOpenedSoft,
        iconColor: isApproved
          ? APP_COLORS.opened
          : isRejected
          ? APP_COLORS.dangerText
          : APP_COLORS.notOpened,
        title: isApproved
          ? 'Izin Diterima'
          : isRejected
          ? 'Izin Ditolak'
          : 'Izin Menunggu Review',
        message: `${courseLabel}${classLabel ? ` · ${classLabel}` : ''}`,
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
          iconName: 'chatbubbles-outline',
          iconBgColor: APP_COLORS.softBlue,
          iconColor: APP_COLORS.primary,
          title: 'Sesi Selesai · Kirim Ulasan',
          message: `${s.courseName} (${s.className})`,
          meta: `${s.date} · ${s.time}`,
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
        iconName:
          rec.status === 'Izin' ? 'document-text-outline' : 'checkmark-circle-outline',
        iconBgColor:
          rec.status === 'Izin' ? APP_COLORS.notOpenedSoft : APP_COLORS.openedSoft,
        iconColor:
          rec.status === 'Izin' ? APP_COLORS.notOpened : APP_COLORS.opened,
        title: `Kehadiran: ${rec.status}`,
        message: `${matchedSchedule?.courseName || 'Praktikum'} · ${rec.timestamp}`,
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
          iconName: 'calendar-outline',
          iconBgColor: APP_COLORS.softBlue,
          iconColor: APP_COLORS.primary,
          title: 'Jadwal Terdaftar',
          message: `${s.courseName} (${s.className}) · ${s.room}`,
          meta: `${s.date} · ${s.time}`,
          onPress: () => {
            setActiveScheduleId(s.id);
            navigation.navigate('SessionDetail', { scheduleId: s.id });
          },
        });
      });

    return items;
  }, [
    activeRole,
    isStudent,
    storedNotifications,
    schedules,
    assistantLeavesBySchedule,
    historyRecords,
    studentLeaves,
    navigation,
    setActiveScheduleId,
  ]);

  const isLoading =
    storedNotifLoading ||
    schedulesLoading ||
    (isStudent && (studentLeavesLoading || historyLoading));

  const showPushWarning =
    !pushRegistration.isRegistering &&
    (pushRegistration.permissionStatus === 'denied' ||
      Boolean(pushRegistration.error));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title="Notifikasi"
        onBack={() => navigation.goBack()}
        hasUnreadNotifications={unreadCount > 0}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {showPushWarning ? (
          <View style={styles.pushStatusBanner}>
            <View style={styles.pushStatusHeader}>
              <Ionicons
                name="notifications-off-outline"
                size={18}
                color={APP_COLORS.dangerText}
              />
              <Text style={styles.pushStatusTitle}>
                {pushRegistration.permissionStatus === 'denied'
                  ? 'Izin Notifikasi Belum Aktif'
                  : 'Push Notification Belum Tersinkron'}
              </Text>
            </View>
            <Text style={styles.pushStatusDesc}>
              {pushRegistration.error ||
                'Aktifkan izin notifikasi agar pemberitahuan pembukaan sesi, perubahan jadwal, dan keputusan izin dapat diterima.'}
            </Text>
            <View style={styles.pushStatusActions}>
              {pushRegistration.permissionStatus === 'denied' ? (
                <Pressable
                  onPress={() => {
                    void openAppNotificationSettings();
                  }}
                  style={({ pressed }) => [
                    styles.pushActionPrimary,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.pushActionPrimaryText}>
                    Buka Pengaturan
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={refreshPushRegistration}
                style={({ pressed }) => [
                  styles.pushActionSecondary,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.pushActionSecondaryText}>Coba Lagi</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {isLoading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={APP_COLORS.primary} />
            <Text style={styles.stateText}>Memuat aktivitas...</Text>
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
            description="Pembaruan sesi, presensi, dan izin akan tampil di sini."
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
                      size={19}
                      color={item.iconColor}
                    />
                  </View>
                  <View style={styles.textContent}>
                    <View style={styles.titleRow}>
                      <Text style={styles.notifTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.unread ? <View style={styles.unreadDot} /> : null}
                    </View>
                    <Text style={styles.notifMessage} numberOfLines={2}>
                      {item.message}
                    </Text>
                    <Text style={styles.notifTime}>{item.meta}</Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={APP_COLORS.textMuted}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

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
    paddingTop: APP_SPACING.xs,
    paddingBottom: APP_SPACING.xxl,
  },
  stateContainer: {
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
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_SPACING.md,
  },
  textContent: {
    flex: 1,
    paddingRight: APP_SPACING.sm,
  },
  notifTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
    marginBottom: 2,
  },
  notifMessage: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    lineHeight: 17,
    marginBottom: 3,
  },
  notifTime: {
    fontFamily: APP_FONTS.regular,
    fontSize: 11,
    color: APP_COLORS.textMuted,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: APP_COLORS.primary,
  },
  pushStatusBanner: {
    backgroundColor: APP_COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: APP_COLORS.danger,
    borderRadius: APP_RADIUS.card,
    padding: APP_SPACING.md,
    marginBottom: APP_SPACING.md,
  },
  pushStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pushStatusTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 13,
    color: APP_COLORS.dangerText,
  },
  pushStatusDesc: {
    fontFamily: APP_FONTS.regular,
    fontSize: 12,
    color: APP_COLORS.inkPrimary,
    lineHeight: 17,
  },
  pushStatusActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  pushActionPrimary: {
    backgroundColor: APP_COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: APP_RADIUS.sm,
  },
  pushActionPrimaryText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.white,
  },
  pushActionSecondary: {
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: APP_RADIUS.sm,
  },
  pushActionSecondaryText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.inkPrimary,
  },
  pressed: {
    opacity: 0.78,
  },
});

export default NotificationScreen;
