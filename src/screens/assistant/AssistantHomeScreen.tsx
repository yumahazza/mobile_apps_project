import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { useFirestoreSchedules } from '@/hooks/useFirestoreSchedules';
import { useRealtimeAttendance } from '@/hooks/useRealtimeAttendance';
import { subscribeToScheduleAttendances } from '@/services/attendanceService';
import {
  openPracticumSession,
  closePracticumSession,
} from '@/services/sessionControlService';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmModal } from '@/components/ConfirmModal';
import { BottomNavigation } from '@/components/BottomNavigation';
import { EmptyState } from '@/components/EmptyState';
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
  APP_FONTS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

interface AssistantHomeScreenProps {
  navigation: NavigationProp;
}

interface BannerNotification {
  visible: boolean;
  type: 'success' | 'info';
  message: string;
}

type ScheduleFilter = 'ALL' | 'DIBUKA' | 'BELUM_DIBUKA' | 'SELESAI';

export const AssistantHomeScreen: React.FC<AssistantHomeScreenProps> = ({
  navigation,
}) => {
  const {
    activeUser,
    activeScheduleId,
    setActiveScheduleId,
  } = useApp();
  const {
    schedules,
    loading: schedulesLoading,
    error: schedulesError,
  } = useFirestoreSchedules(activeUser.id, 'assistant');

  const activeSchedule =
    schedules.find((schedule) => schedule.id === activeScheduleId) ||
    schedules[0];

  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>('ALL');

  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    action: 'open' | 'close';
    scheduleId: string;
  }>({
    visible: false,
    action: 'open',
    scheduleId: '',
  });

  const [notification, setNotification] = useState<BannerNotification>({
    visible: false,
    type: 'success',
    message: '',
  });

  const [hadirCountsBySchedule, setHadirCountsBySchedule] = useState<
    Record<string, number>
  >({});

  const scheduleIdsKey = schedules.map((schedule) => schedule.id).join('|');

  useEffect(() => {
    if (!scheduleIdsKey) {
      return undefined;
    }

    const scheduleIds = scheduleIdsKey.split('|').filter(Boolean);
    const unsubscribes = scheduleIds.map((scheduleId) =>
      subscribeToScheduleAttendances(
        scheduleId,
        (records) => {
          const hadir = records.filter((item) => item.status === 'Hadir').length;
          setHadirCountsBySchedule((prev) =>
            prev[scheduleId] === hadir ? prev : { ...prev, [scheduleId]: hadir },
          );
        },
        () => {
          // Abaikan error per jadwal agar ringkasan lain tetap tampil.
        },
      ),
    );

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [scheduleIdsKey]);

  const showNotification = (
    message: string,
    type: 'success' | 'info' = 'success',
  ) => {
    setNotification({ visible: true, type, message });
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, visible: false }));
    }, 4000);
  };

  const currentSchedule = activeSchedule || schedules[0];
  const { stats } = useRealtimeAttendance(
    currentSchedule?.id,
    currentSchedule?.totalStudents ?? 0,
  );

  const targetScheduleForModal =
    schedules.find((s) => s.id === confirmModal.scheduleId) || currentSchedule;

  const handleOpenSessionModal = (scheduleId: string) => {
    setConfirmModal({
      visible: true,
      action: 'open',
      scheduleId,
    });
  };

  const handleCloseSessionModal = (scheduleId: string) => {
    setConfirmModal({
      visible: true,
      action: 'close',
      scheduleId,
    });
  };

  const handleConfirmAction = async () => {
    const { action, scheduleId } = confirmModal;
    const target =
      schedules.find((schedule) => schedule.id === scheduleId) ||
      currentSchedule;
    try {
      if (action === 'open') {
        await openPracticumSession(scheduleId, activeUser.id);
      } else {
        await closePracticumSession(scheduleId, activeUser.id);
      }
      showNotification(
        `${target?.courseName} (${target?.className}) berhasil ${
          action === 'open' ? 'dibuka' : 'ditutup'
        }.`,
        action === 'open' ? 'success' : 'info',
      );
    } catch (error) {
      Alert.alert(
        'Gagal memperbarui sesi',
        error instanceof Error
          ? error.message
          : 'Periksa koneksi dan izin akses.',
      );
    } finally {
      setConfirmModal({ visible: false, action: 'open', scheduleId: '' });
    }
  };

  const attendancePercent = currentSchedule ? stats.attendancePercentage : 0;
  const openSessions = schedules.filter(
    (schedule) => schedule.status === 'DIBUKA',
  ).length;
  const waitingSessions = schedules.filter(
    (schedule) => schedule.status === 'BELUM_DIBUKA',
  ).length;
  const finishedSessions = schedules.filter(
    (schedule) => schedule.status === 'SELESAI',
  ).length;

  const totalRegistered = currentSchedule ? stats.totalRegistered : 0;
  const hadirCount = currentSchedule ? stats.hadirCount : 0;
  const izinCount = currentSchedule ? stats.izinCount : 0;

  const filteredSchedules = useMemo(() => {
    if (scheduleFilter === 'ALL') return schedules;
    return schedules.filter((item) => item.status === scheduleFilter);
  }, [schedules, scheduleFilter]);

  const userInitials = (activeUser.name || 'A')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Top Bar Selaras dengan Layar Lain */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            style={({ pressed }) => [
              styles.identityRow,
              pressed && styles.pressed,
            ]}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{userInitials}</Text>
            </View>
            <View style={styles.identityTextGroup}>
              <Text style={styles.userName} numberOfLines={1}>
                Halo, {activeUser.name.split(' ')[0]}
              </Text>
              <Text style={styles.userRole} numberOfLines={1}>
                Asisten Praktikum
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Notifikasi"
            style={({ pressed }) => [
              styles.notifButton,
              pressed && styles.pressed,
            ]}>
            <Ionicons
              name="notifications-outline"
              size={20}
              color={APP_COLORS.inkPrimary}
            />
            <View style={styles.notifDot} />
          </Pressable>
        </View>

        {/* Banner Notifikasi Aksi */}
        {notification.visible && (
          <View
            style={[
              styles.notificationBanner,
              notification.type === 'success'
                ? styles.bannerSuccess
                : styles.bannerInfo,
            ]}>
            <Ionicons
              name={
                notification.type === 'success'
                  ? 'checkmark-circle'
                  : 'information-circle'
              }
              size={18}
              color={
                notification.type === 'success'
                  ? APP_COLORS.opened
                  : APP_COLORS.primary
              }
            />
            <Text style={styles.notificationText}>{notification.message}</Text>
            <Pressable
              onPress={() =>
                setNotification((prev) => ({ ...prev, visible: false }))
              }
              hitSlop={8}
              style={styles.closeNotification}>
              <Ionicons name="close" size={16} color={APP_COLORS.textSecondary} />
            </Pressable>
          </View>
        )}

        {/* Judul Seksi Utama */}
        <View style={styles.sectionHeader}>
          <Text style={styles.screenTitle}>Jadwal Hari Ini</Text>
          <Pressable
            onPress={() =>
              navigation.navigate(
                'StudentList',
                currentSchedule ? { scheduleId: currentSchedule.id } : undefined,
              )
            }
            hitSlop={6}
            style={({ pressed }) => [styles.linkAction, pressed && styles.pressed]}>
            <Text style={styles.linkActionText}>Daftar Peserta</Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={APP_COLORS.primary}
            />
          </Pressable>
        </View>

        {/* Single Hero Card Sesi Aktif / Terpilih (#273287 + #D8E63C) */}
        {currentSchedule ? (
          <Pressable
            onPress={() => {
              setActiveScheduleId(currentSchedule.id);
              navigation.navigate('SessionDetail', {
                scheduleId: currentSchedule.id,
              });
            }}
            style={({ pressed }) => [
              styles.heroCard,
              pressed && styles.pressed,
            ]}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroClassPill}>
                <Text style={styles.heroClassText}>
                  {currentSchedule.className}
                </Text>
              </View>
              <StatusBadge status={currentSchedule.status} size="sm" />
            </View>

            <Text style={styles.heroCourseTitle} numberOfLines={2}>
              {currentSchedule.courseName}
            </Text>

            <View style={styles.heroMetaRow}>
              <Ionicons
                name="time-outline"
                size={14}
                color="rgba(255,255,255,0.85)"
              />
              <Text style={styles.heroMetaText}>
                {currentSchedule.time} · {currentSchedule.room} · {currentSchedule.date}
              </Text>
            </View>

            <View style={styles.heroDivider} />

            {/* Progres Kehadiran Ringkas */}
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabelText}>
                  {hadirCount}/{totalRegistered} Hadir
                </Text>
                <Text style={styles.progressPercentText}>
                  {attendancePercent}%
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, Math.max(0, attendancePercent))}%`,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Aksi Utama Sesi */}
            <View style={styles.heroActionRow}>
              {currentSchedule.status !== 'SELESAI' ? (
                <Pressable
                  onPress={() => {
                    if (currentSchedule.status === 'DIBUKA') {
                      handleCloseSessionModal(currentSchedule.id);
                    } else {
                      handleOpenSessionModal(currentSchedule.id);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.heroPrimaryBtn,
                    currentSchedule.status === 'DIBUKA' &&
                      styles.heroDangerBtn,
                    pressed && styles.pressed,
                  ]}>
                  <Ionicons
                    name={
                      currentSchedule.status === 'DIBUKA'
                        ? 'stop-circle-outline'
                        : 'play-circle-outline'
                    }
                    size={16}
                    color={
                      currentSchedule.status === 'DIBUKA'
                        ? APP_COLORS.white
                        : APP_COLORS.tetsuKon
                    }
                  />
                  <Text
                    style={[
                      styles.heroPrimaryBtnText,
                      currentSchedule.status === 'DIBUKA' &&
                        styles.heroDangerBtnText,
                    ]}>
                    {currentSchedule.status === 'DIBUKA'
                      ? 'Tutup Sesi'
                      : 'Buka Sesi'}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() =>
                    navigation.navigate('SessionRecap', {
                      scheduleId: currentSchedule.id,
                    })
                  }
                  style={({ pressed }) => [
                    styles.heroPrimaryBtn,
                    pressed && styles.pressed,
                  ]}>
                  <Ionicons
                    name="bar-chart-outline"
                    size={16}
                    color={APP_COLORS.tetsuKon}
                  />
                  <Text style={styles.heroPrimaryBtnText}>Lihat Rekap</Text>
                </Pressable>
              )}

              <Pressable
                onPress={() =>
                  navigation.navigate('LeaveApproval', {
                    scheduleId: currentSchedule.id,
                  })
                }
                style={({ pressed }) => [
                  styles.heroSecondaryBtn,
                  pressed && styles.pressed,
                ]}>
                <Ionicons
                  name="clipboard-outline"
                  size={16}
                  color={APP_COLORS.white}
                />
                <Text style={styles.heroSecondaryBtnText}>Review Izin</Text>
              </Pressable>
            </View>
          </Pressable>
        ) : !schedulesLoading && !schedulesError ? (
          <EmptyState
            icon="calendar-outline"
            title="Belum Ada Jadwal"
            description="Tambahkan jadwal praktikum pertama melalui menu Jadwal."
            actionTitle="Kelola Jadwal"
            onActionPress={() => navigation.navigate('ScheduleList')}
          />
        ) : null}

        {/* Ringkasan Singkat 1 Baris (Menggantikan Bento Grid Berlebihan) */}
        <View style={styles.summaryStrip}>
          <Pressable
            onPress={() => navigation.navigate('ScheduleList')}
            style={({ pressed }) => [
              styles.summaryCell,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.summaryNumber}>{schedules.length}</Text>
            <Text style={styles.summaryLabel}>Total Sesi</Text>
          </Pressable>

          <View style={styles.summaryDivider} />

          <Pressable
            onPress={() =>
              navigation.navigate(
                'SessionControl',
                currentSchedule ? { scheduleId: currentSchedule.id } : undefined,
              )
            }
            style={({ pressed }) => [
              styles.summaryCell,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.summaryNumber}>{openSessions}</Text>
            <Text style={styles.summaryLabel}>Dibuka</Text>
          </Pressable>

          <View style={styles.summaryDivider} />

          <Pressable
            onPress={() =>
              navigation.navigate(
                'LeaveApproval',
                currentSchedule ? { scheduleId: currentSchedule.id } : undefined,
              )
            }
            style={({ pressed }) => [
              styles.summaryCell,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.summaryNumber}>{izinCount}</Text>
            <Text style={styles.summaryLabel}>Izin</Text>
          </Pressable>
        </View>

        <View style={styles.sectionDivider} />

        {/* Daftar Sesi dengan Filter Pill */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeading}>Daftar Sesi</Text>
          <Pressable
            onPress={() => navigation.navigate('ScheduleList')}
            hitSlop={6}
            style={({ pressed }) => [styles.linkAction, pressed && styles.pressed]}>
            <Text style={styles.linkActionText}>Kelola Jadwal</Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={APP_COLORS.primary}
            />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsRow}>
          {[
            {
              key: 'ALL' as ScheduleFilter,
              label: 'Semua',
              count: schedules.length,
            },
            {
              key: 'DIBUKA' as ScheduleFilter,
              label: 'Dibuka',
              count: openSessions,
            },
            {
              key: 'BELUM_DIBUKA' as ScheduleFilter,
              label: 'Menunggu',
              count: waitingSessions,
            },
            {
              key: 'SELESAI' as ScheduleFilter,
              label: 'Selesai',
              count: finishedSessions,
            },
          ].map((pill) => {
            const active = scheduleFilter === pill.key;
            return (
              <Pressable
                key={pill.key}
                onPress={() => setScheduleFilter(pill.key)}
                style={[
                  styles.filterPill,
                  active && styles.filterPillActive,
                ]}>
                <Text
                  style={[
                    styles.filterPillText,
                    active && styles.filterPillTextActive,
                  ]}>
                  {pill.label} ({pill.count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {schedulesLoading && (
          <View style={styles.stateBanner}>
            <Text style={styles.stateBannerText}>Memuat jadwal...</Text>
          </View>
        )}
        {!!schedulesError && (
          <View style={styles.stateBanner}>
            <Text style={styles.stateBannerText}>{schedulesError}</Text>
          </View>
        )}
        {!schedulesLoading &&
          !schedulesError &&
          schedules.length > 0 &&
          filteredSchedules.length === 0 && (
            <EmptyState
              icon="calendar-clear-outline"
              title="Tidak Ada Sesi"
              description="Pilih kategori filter lain untuk melihat jadwal."
            />
          )}

        <View style={styles.scheduleList}>
          {filteredSchedules.map((item, idx) => {
            const isSelected = item.id === currentSchedule?.id;
            const itemHadir = hadirCountsBySchedule[item.id] ?? 0;
            const itemTotal = item.totalStudents || 0;

            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  setActiveScheduleId(item.id);
                  navigation.navigate('SessionDetail', {
                    scheduleId: item.id,
                  });
                }}
                style={({ pressed }) => [
                  styles.scheduleCard,
                  idx % 2 === 1 && !isSelected && styles.scheduleCardTint,
                  isSelected && styles.scheduleCardSelected,
                  pressed && styles.pressed,
                ]}>
                <View style={styles.scheduleCardTop}>
                  <View style={styles.scheduleTitleCol}>
                    <Text style={styles.scheduleCourseName} numberOfLines={1}>
                      {item.courseName}
                    </Text>
                    <Text style={styles.scheduleMeta} numberOfLines={1}>
                      {item.className} · {item.room} · {item.date}
                    </Text>
                  </View>
                  <StatusBadge status={item.status} size="sm" />
                </View>

                <View style={styles.scheduleCardFooter}>
                  <View style={styles.metaChip}>
                    <Ionicons
                      name="people-outline"
                      size={13}
                      color={APP_COLORS.textSecondary}
                    />
                    <Text style={styles.metaChipText}>
                      {itemHadir}/{itemTotal} Hadir
                    </Text>
                  </View>

                  <View style={styles.timePill}>
                    <Text style={styles.timePillText}>{item.time}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.action === 'open' ? 'Buka Sesi?' : 'Tutup Sesi?'}
        subtitle={
          confirmModal.action === 'open'
            ? 'Praktikan dapat langsung melakukan presensi.'
            : 'Presensi akan ditutup setelah sesi berakhir.'
        }
        details={{
          courseName: targetScheduleForModal?.courseName,
          className: targetScheduleForModal?.className,
          time: targetScheduleForModal?.time,
          room: targetScheduleForModal?.room,
        }}
        confirmText={confirmModal.action === 'open' ? 'Ya, Buka' : 'Tutup Sesi'}
        cancelText="Batal"
        confirmVariant={confirmModal.action === 'open' ? 'primary' : 'danger'}
        onConfirm={handleConfirmAction}
        onCancel={() =>
          setConfirmModal({ visible: false, action: 'open', scheduleId: '' })
        }
      />

      <BottomNavigation
        role="assistant"
        activeTab="AssistantHome"
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
    paddingTop: APP_SPACING.sm,
    paddingBottom: APP_SPACING.xxl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: APP_SPACING.lg,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: APP_SPACING.sm,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: APP_COLORS.nordicBreeze,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_SPACING.md,
  },
  avatarInitials: {
    fontFamily: APP_FONTS.bold,
    fontSize: 15,
    color: APP_COLORS.tetsuKon,
  },
  identityTextGroup: {
    flex: 1,
  },
  userName: {
    fontFamily: APP_FONTS.bold,
    fontSize: 16,
    lineHeight: 22,
    color: APP_COLORS.inkPrimary,
  },
  userRole: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: APP_COLORS.textSecondary,
  },
  notifButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: APP_COLORS.danger,
    borderWidth: 1.5,
    borderColor: APP_COLORS.white,
  },
  notificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: APP_SPACING.md,
    borderRadius: APP_RADIUS.md,
    marginBottom: APP_SPACING.md,
    borderWidth: 1,
  },
  bannerSuccess: {
    backgroundColor: APP_COLORS.openedSoft,
    borderColor: '#BBF7D0',
  },
  bannerInfo: {
    backgroundColor: APP_COLORS.softBlue,
    borderColor: APP_COLORS.infoBorder,
  },
  notificationText: {
    flex: 1,
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: APP_COLORS.inkPrimary,
    marginLeft: APP_SPACING.sm,
  },
  closeNotification: {
    padding: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: APP_SPACING.md,
  },
  screenTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
    color: APP_COLORS.inkPrimary,
    letterSpacing: -0.3,
  },
  sectionHeading: {
    fontFamily: APP_FONTS.bold,
    fontSize: 17,
    lineHeight: 22,
    color: APP_COLORS.inkPrimary,
  },
  linkAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 32,
  },
  linkActionText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 13,
    color: APP_COLORS.primary,
  },
  heroCard: {
    backgroundColor: APP_COLORS.intergalactic,
    borderRadius: APP_RADIUS.hero,
    padding: APP_SPACING.xl,
    marginBottom: APP_SPACING.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: APP_SPACING.md,
  },
  heroClassPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: APP_RADIUS.pill,
  },
  heroClassText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.white,
  },
  heroCourseTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
    color: APP_COLORS.durantaYellow,
    marginBottom: 6,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMetaText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.88)',
    flex: 1,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginVertical: APP_SPACING.md,
  },
  progressSection: {
    marginBottom: APP_SPACING.md,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabelText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.white,
  },
  progressPercentText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 13,
    color: APP_COLORS.durantaYellow,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: APP_COLORS.durantaYellow,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: APP_COLORS.durantaYellow,
    borderRadius: APP_RADIUS.md,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  heroDangerBtn: {
    backgroundColor: APP_COLORS.danger,
  },
  heroPrimaryBtnText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 14,
    color: APP_COLORS.tetsuKon,
  },
  heroDangerBtnText: {
    color: APP_COLORS.white,
  },
  heroSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: APP_RADIUS.md,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  heroSecondaryBtnText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 13,
    color: APP_COLORS.white,
  },
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    paddingVertical: APP_SPACING.md,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: APP_COLORS.divider,
  },
  summaryNumber: {
    fontFamily: APP_FONTS.bold,
    fontSize: 18,
    color: APP_COLORS.inkPrimary,
  },
  summaryLabel: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: APP_COLORS.border,
    marginVertical: APP_SPACING.xl,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: APP_SPACING.md,
  },
  filterPill: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: APP_RADIUS.pill,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  filterPillActive: {
    backgroundColor: APP_COLORS.primary,
    borderColor: APP_COLORS.primary,
  },
  filterPillText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  filterPillTextActive: {
    color: APP_COLORS.white,
  },
  stateBanner: {
    padding: APP_SPACING.md,
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.md,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.md,
  },
  stateBannerText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
  },
  scheduleList: {
    gap: APP_SPACING.sm,
  },
  scheduleCard: {
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.card,
    padding: APP_SPACING.lg,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  scheduleCardTint: {
    backgroundColor: APP_COLORS.nordicBreeze,
    borderColor: APP_COLORS.nordicBreeze,
  },
  scheduleCardSelected: {
    borderColor: APP_COLORS.primary,
    borderWidth: 1.5,
  },
  scheduleCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: APP_SPACING.sm,
    marginBottom: APP_SPACING.sm,
  },
  scheduleTitleCol: {
    flex: 1,
  },
  scheduleCourseName: {
    fontFamily: APP_FONTS.bold,
    fontSize: 15,
    color: APP_COLORS.inkPrimary,
    marginBottom: 2,
  },
  scheduleMeta: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  scheduleCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaChipText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  timePill: {
    backgroundColor: APP_COLORS.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: APP_RADIUS.sm,
  },
  timePillText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 11,
    color: APP_COLORS.inkPrimary,
  },
  pressed: {
    opacity: 0.8,
  },
});

export default AssistantHomeScreen;
