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
import { HeaderRolePicker } from '@/components/HeaderRolePicker';
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
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
          // Abaikan error per jadwal agar ringkasan jadwal lain tetap tampil.
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
        `Sesi "${target?.courseName} - ${target?.className}" berhasil ${
          action === 'open' ? 'DIBUKA' : 'DITUTUP'
        }.`,
        action === 'open' ? 'success' : 'info',
      );
    } catch (error) {
      Alert.alert(
        'Gagal memperbarui sesi',
        error instanceof Error
          ? error.message
          : 'Periksa koneksi dan Firestore Rules.',
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
  const alfaCount = currentSchedule ? stats.alfaCount : 0;

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
        {/* Top Profile & Action Bar (Reference UI image 3, 4, 7) */}
        <View style={styles.topProfileBar}>
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            style={({ pressed }) => [
              styles.profileIdentityRow,
              pressed && styles.pressed,
            ]}>
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarInitials}>{userInitials}</Text>
            </View>
            <View style={styles.profileTextGroup}>
              <Text style={styles.profileNameText} numberOfLines={1}>
                {activeUser.name}
              </Text>
              <View style={styles.roleBadgePill}>
                <Ionicons name="sparkles" size={10} color="#1E293B" />
                <Text style={styles.roleBadgeText}>Asisten Praktikum</Text>
              </View>
            </View>
          </Pressable>

          <View style={styles.topActionsGroup}>
            <HeaderRolePicker compact />
            <Pressable
              onPress={() => navigation.navigate('ScheduleList')}
              accessibilityRole="button"
              accessibilityLabel="Kelola Jadwal"
              style={({ pressed }) => [
                styles.topIconCircle,
                pressed && styles.pressed,
              ]}>
              <Ionicons name="calendar-outline" size={19} color="#0F172A" />
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Notifications')}
              accessibilityRole="button"
              accessibilityLabel="Notifikasi"
              style={({ pressed }) => [
                styles.topIconCircle,
                pressed && styles.pressed,
              ]}>
              <Ionicons name="notifications-outline" size={19} color="#0F172A" />
              <View style={styles.notifDot} />
            </Pressable>
          </View>
        </View>

        {/* Editorial Hero Title */}
        <View style={styles.heroTitleBlock}>
          <Text style={styles.heroTitle}>
            Kelola Sesi &{'\n'}Presensi Praktikum
          </Text>
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
              style={styles.closeNotification}>
              <Ionicons name="close" size={16} color={APP_COLORS.neutral500} />
            </Pressable>
          </View>
        )}

        {/* 2x2 Bento Summary Grid (Reference UI image 4 & image 5) */}
        <View style={styles.bentoSectionHeader}>
          <Text style={styles.sectionHeading}>Ringkasan Praktikum</Text>
          <Pressable
            onPress={() =>
              navigation.navigate(
                'StudentList',
                currentSchedule ? { scheduleId: currentSchedule.id } : undefined,
              )
            }
            style={({ pressed }) => [
              styles.textActionLink,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.textActionLabel}>Daftar Peserta</Text>
            <Ionicons name="arrow-forward" size={14} color="#4F46E5" />
          </Pressable>
        </View>

        <View style={styles.bentoGrid}>
          <View style={styles.bentoRow}>
            {/* Tile 1: Total Kelas (Periwinkle Blue) */}
            <Pressable
              onPress={() => navigation.navigate('ScheduleList')}
              style={({ pressed }) => [
                styles.bentoCard,
                styles.bentoPeriwinkle,
                pressed && styles.pressed,
              ]}>
              <View style={styles.bentoDecorCircle} />
              <View style={styles.bentoTopRow}>
                <Text style={styles.bentoNumber}>{schedules.length}</Text>
                <View style={styles.bentoIconDotDark}>
                  <Ionicons name="calendar" size={14} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.bentoTitle}>Total Kelas</Text>
              <Text style={styles.bentoMeta}>{openSessions} sedang dibuka</Text>
            </Pressable>

            {/* Tile 2: Hadir Sesi Aktif (Orchid Pink/Lavender) */}
            <Pressable
              onPress={() =>
                navigation.navigate(
                  'SessionRecap',
                  currentSchedule
                    ? { scheduleId: currentSchedule.id }
                    : undefined,
                )
              }
              style={({ pressed }) => [
                styles.bentoCard,
                styles.bentoLavender,
                pressed && styles.pressed,
              ]}>
              <View style={styles.bentoDecorCircle} />
              <View style={styles.bentoTopRow}>
                <Text style={styles.bentoNumber}>{hadirCount}</Text>
                <View style={styles.bentoIconDotLight}>
                  <Ionicons name="people" size={14} color="#0F172A" />
                </View>
              </View>
              <Text style={styles.bentoTitle}>Hadir Sesi Ini</Text>
              <Text style={styles.bentoMeta}>
                dari {totalRegistered} mahasiswa ({attendancePercent}%)
              </Text>
            </Pressable>
          </View>

          <View style={styles.bentoRow}>
            {/* Tile 3: Izin & Alfa (Warm Amber) */}
            <Pressable
              onPress={() =>
                navigation.navigate(
                  'LeaveApproval',
                  currentSchedule
                    ? { scheduleId: currentSchedule.id }
                    : undefined,
                )
              }
              style={({ pressed }) => [
                styles.bentoCard,
                styles.bentoAmber,
                pressed && styles.pressed,
              ]}>
              <View style={styles.bentoDecorCircle} />
              <View style={styles.bentoTopRow}>
                <Text style={styles.bentoNumber}>{izinCount}</Text>
                <View style={styles.bentoIconDotLight}>
                  <Ionicons name="document-text" size={14} color="#0F172A" />
                </View>
              </View>
              <Text style={styles.bentoTitle}>Izin Disetujui</Text>
              <Text style={styles.bentoMeta}>
                {alfaCount} belum hadir • Review manual
              </Text>
            </Pressable>

            {/* Tile 4: Kontrol Sesi (Fresh Emerald) */}
            <Pressable
              onPress={() =>
                navigation.navigate(
                  'SessionControl',
                  currentSchedule
                    ? { scheduleId: currentSchedule.id }
                    : undefined,
                )
              }
              style={({ pressed }) => [
                styles.bentoCard,
                styles.bentoEmerald,
                pressed && styles.pressed,
              ]}>
              <View style={styles.bentoDecorCircle} />
              <View style={styles.bentoTopRow}>
                <Text style={styles.bentoNumber}>{attendancePercent}%</Text>
                <View style={styles.bentoIconDotLight}>
                  <Ionicons name="pulse" size={14} color="#0F172A" />
                </View>
              </View>
              <Text style={styles.bentoTitle}>Tingkat Hadir</Text>
              <Text style={styles.bentoMeta}>
                {currentSchedule?.status === 'DIBUKA'
                  ? 'Sesi sedang berjalan'
                  : currentSchedule?.status === 'SELESAI'
                  ? 'Sesi selesai'
                  : 'Sesi belum dibuka'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Featured Active Session Hero Card (Reference UI image 6 & image 7) */}
        {currentSchedule && (
          <View style={styles.featuredSection}>
            <View style={styles.bentoSectionHeader}>
              <View style={styles.sectionTitleWithBadge}>
                <Text style={styles.sectionHeading}>Sesi Terpilih</Text>
                <View style={styles.countPillDark}>
                  <Text style={styles.countPillDarkText}>
                    {currentSchedule.className}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() =>
                  navigation.navigate('SessionDetail', {
                    scheduleId: currentSchedule.id,
                  })
                }
                style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.textActionLabel}>Detail Sesi</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                setActiveScheduleId(currentSchedule.id);
                navigation.navigate('SessionDetail', {
                  scheduleId: currentSchedule.id,
                });
              }}
              style={({ pressed }) => [
                styles.heroSessionCard,
                currentSchedule.status === 'DIBUKA' &&
                  styles.heroSessionCardActive,
                pressed && styles.pressed,
              ]}>
              <View style={styles.heroSessionTopRow}>
                <View style={styles.heroIconTile}>
                  <Ionicons name="desktop-outline" size={20} color="#0F172A" />
                </View>
                <StatusBadge status={currentSchedule.status} size="sm" />
              </View>

              <Text style={styles.heroCourseTitle}>
                {currentSchedule.courseName}
              </Text>

              <View style={styles.heroTagRow}>
                <View style={styles.heroTagPill}>
                  <Ionicons name="time-outline" size={13} color="#334155" />
                  <Text style={styles.heroTagText}>{currentSchedule.time}</Text>
                </View>
                <View style={styles.heroTagPill}>
                  <Ionicons name="location-outline" size={13} color="#334155" />
                  <Text style={styles.heroTagText}>{currentSchedule.room}</Text>
                </View>
                <View style={styles.heroTagPill}>
                  <Ionicons name="calendar-outline" size={13} color="#334155" />
                  <Text style={styles.heroTagText}>{currentSchedule.date}</Text>
                </View>
              </View>

              {/* Progress Bar Kehadiran (Reference UI image 3, 7, 9) */}
              <View style={styles.progressSection}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabelText}>
                    Progres Kehadiran ({hadirCount}/{totalRegistered} hadir)
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

              {/* Action Bar inside Hero Card */}
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
                      styles.primaryPillBtn,
                      currentSchedule.status === 'DIBUKA' &&
                        styles.dangerPillBtn,
                      pressed && styles.pressed,
                    ]}>
                    <Ionicons
                      name={
                        currentSchedule.status === 'DIBUKA'
                          ? 'stop-circle-outline'
                          : 'play-circle-outline'
                      }
                      size={17}
                      color="#FFFFFF"
                    />
                    <Text style={styles.primaryPillBtnText}>
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
                      styles.primaryPillBtn,
                      pressed && styles.pressed,
                    ]}>
                    <Ionicons
                      name="bar-chart-outline"
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={styles.primaryPillBtnText}>
                      Lihat Rekap & Ulasan AI
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() =>
                    navigation.navigate('LeaveApproval', {
                      scheduleId: currentSchedule.id,
                    })
                  }
                  style={({ pressed }) => [
                    styles.secondaryPillBtn,
                    pressed && styles.pressed,
                  ]}>
                  <Ionicons
                    name="clipboard-outline"
                    size={16}
                    color="#0F172A"
                  />
                  <Text style={styles.secondaryPillBtnText}>Review Izin</Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        )}

        {/* Daftar Sesi dengan Filter Pill (Reference UI image 4 & image 1) */}
        <View style={styles.scheduleSection}>
          <View style={styles.bentoSectionHeader}>
            <Text style={styles.sectionHeading}>Daftar Sesi Praktikum</Text>
            <Pressable
              onPress={() => navigation.navigate('ScheduleList')}
              style={({ pressed }) => [
                styles.addMiniPill,
                pressed && styles.pressed,
              ]}>
              <Ionicons name="add" size={15} color="#FFFFFF" />
              <Text style={styles.addMiniPillText}>Kelola</Text>
            </Pressable>
          </View>

          {/* Filter Pills (Reference UI image 4: Complete 65 / To Do 45 / In Review 3) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsRow}>
            {[
              {
                key: 'ALL' as ScheduleFilter,
                label: 'Semua',
                count: schedules.length,
                badgeColor: '#A7F3D0',
              },
              {
                key: 'DIBUKA' as ScheduleFilter,
                label: 'Dibuka',
                count: openSessions,
                badgeColor: '#86EFAC',
              },
              {
                key: 'BELUM_DIBUKA' as ScheduleFilter,
                label: 'Menunggu',
                count: waitingSessions,
                badgeColor: '#FDE68A',
              },
              {
                key: 'SELESAI' as ScheduleFilter,
                label: 'Selesai',
                count: finishedSessions,
                badgeColor: '#DDD6FE',
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
                    {pill.label}
                  </Text>
                  <View
                    style={[
                      styles.filterCountCircle,
                      {
                        backgroundColor: active ? pill.badgeColor : '#E2E8F0',
                      },
                    ]}>
                    <Text style={styles.filterCountText}>{pill.count}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {schedulesLoading && (
            <View style={styles.notificationBanner}>
              <Text style={styles.notificationText}>
                Memuat jadwal real-time dari Firestore...
              </Text>
            </View>
          )}
          {!!schedulesError && (
            <View style={styles.notificationBanner}>
              <Text style={styles.notificationText}>{schedulesError}</Text>
            </View>
          )}
          {!schedulesLoading &&
            !schedulesError &&
            filteredSchedules.length === 0 && (
              <View style={styles.emptyScheduleCard}>
                <Ionicons
                  name="calendar-clear-outline"
                  size={28}
                  color="#64748B"
                />
                <Text style={styles.emptyScheduleTitle}>
                  Tidak ada sesi pada kategori ini
                </Text>
                <Text style={styles.emptyScheduleSub}>
                  Pilih filter lain atau tambahkan jadwal praktikum baru di menu
                  Jadwal.
                </Text>
              </View>
            )}

          <View style={styles.scheduleCardsList}>
            {filteredSchedules.map((item) => {
              const isSelected = item.id === currentSchedule?.id;
              const itemHadir = hadirCountsBySchedule[item.id] ?? 0;
              const itemTotal = item.totalStudents || 0;
              const itemPercent =
                itemTotal > 0 ? Math.round((itemHadir / itemTotal) * 100) : 0;

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
                    styles.taskStyleCard,
                    isSelected && styles.taskStyleCardSelected,
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.taskCardHeader}>
                    <Text style={styles.taskCardTitle} numberOfLines={1}>
                      {item.courseName}
                    </Text>
                    <StatusBadge status={item.status} size="sm" />
                  </View>

                  <View style={styles.taskChipsRow}>
                    <View style={[styles.taskChip, styles.taskChipPurple]}>
                      <Text style={styles.taskChipPurpleText}>
                        {item.className}
                      </Text>
                    </View>
                    <View style={[styles.taskChip, styles.taskChipBlue]}>
                      <Text style={styles.taskChipBlueText}>{item.room}</Text>
                    </View>
                  </View>

                  <View style={styles.taskCardFooter}>
                    <View style={styles.taskDateRow}>
                      <Ionicons
                        name="calendar-outline"
                        size={13}
                        color="#64748B"
                      />
                      <Text style={styles.taskDateText}>{item.date}</Text>
                      <Text style={styles.taskDot}>•</Text>
                      <Ionicons
                        name="people-outline"
                        size={13}
                        color="#64748B"
                      />
                      <Text style={styles.taskDateText}>
                        {itemHadir}/{itemTotal} ({itemPercent}%)
                      </Text>
                    </View>

                    <View style={styles.darkTimePill}>
                      <Text style={styles.darkTimePillText}>{item.time}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.action === 'open' ? 'Buka Sesi?' : 'Tutup Sesi?'}
        subtitle={
          confirmModal.action === 'open'
            ? 'Praktikan akan dapat melakukan presensi setelah sesi dibuka.'
            : 'Setelah sesi ditutup, praktikan tidak dapat melakukan presensi lagi.'
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

      {/* Floating Bottom Navigation */}
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
    backgroundColor: '#F5F6FA',
  },
  scrollContent: {
    paddingHorizontal: APP_SPACING.lg,
    paddingTop: APP_SPACING.sm,
    paddingBottom: APP_SPACING.xxl,
  },
  topProfileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: APP_SPACING.md,
  },
  profileIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: APP_SPACING.sm,
  },
  avatarBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1E1B4B',
    borderWidth: 2,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileTextGroup: {
    flex: 1,
  },
  profileNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  roleBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#D9F99D',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E293B',
  },
  topActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F43F5E',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  heroTitleBlock: {
    marginBottom: APP_SPACING.lg,
  },
  heroTitle: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  bentoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  textActionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  textActionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  bentoGrid: {
    gap: 12,
    marginBottom: APP_SPACING.xl,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bentoCard: {
    flex: 1,
    minHeight: 118,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#0F172A',
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  bentoPeriwinkle: {
    backgroundColor: '#C7D2FE',
  },
  bentoLavender: {
    backgroundColor: '#F5D0FE',
  },
  bentoAmber: {
    backgroundColor: '#FDE68A',
  },
  bentoEmerald: {
    backgroundColor: '#86EFAC',
  },
  bentoDecorCircle: {
    position: 'absolute',
    right: -22,
    bottom: -28,
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  bentoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bentoNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.6,
  },
  bentoIconDotDark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoIconDotLight: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  bentoMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    marginTop: 2,
  },
  featuredSection: {
    marginBottom: APP_SPACING.xl,
  },
  sectionTitleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countPillDark: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  countPillDarkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSessionCard: {
    backgroundColor: '#CFFAFE',
    borderRadius: 26,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  heroSessionCardActive: {
    backgroundColor: '#A5F3FC',
  },
  heroSessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heroIconTile: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCourseTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  heroTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  heroTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.12)',
  },
  heroTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  progressPercentText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.15)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#0F172A',
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    minHeight: 46,
  },
  dangerPillBtn: {
    backgroundColor: '#DC2626',
  },
  primaryPillBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  secondaryPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0F172A',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    minHeight: 46,
  },
  secondaryPillBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  scheduleSection: {
    marginBottom: APP_SPACING.md,
  },
  addMiniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  addMiniPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 14,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  filterCountCircle: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  scheduleCardsList: {
    gap: 12,
  },
  taskStyleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  taskStyleCardSelected: {
    backgroundColor: '#F0FDF4',
  },
  taskCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  taskCardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  taskChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  taskChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  taskChipPurple: {
    backgroundColor: '#F3E8FF',
  },
  taskChipPurpleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B21A8',
  },
  taskChipBlue: {
    backgroundColor: '#DBEAFE',
  },
  taskChipBlueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  taskCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  taskDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  taskDot: {
    fontSize: 12,
    color: '#94A3B8',
  },
  darkTimePill: {
    backgroundColor: '#181824',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 10,
  },
  darkTimePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyScheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  emptyScheduleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  emptyScheduleSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  notificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: APP_SPACING.md,
    borderRadius: 16,
    marginBottom: APP_SPACING.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bannerSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  bannerInfo: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  notificationText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginLeft: APP_SPACING.sm,
  },
  closeNotification: {
    padding: 4,
  },
  pressed: {
    opacity: 0.78,
  },
});

export default AssistantHomeScreen;
