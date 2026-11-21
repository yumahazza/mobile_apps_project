import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { useFirestoreSchedules } from '@/hooks/useFirestoreSchedules';
import {
  subscribeToStudentAttendanceForSchedule,
} from '@/services/attendanceService';
import type { AttendanceRecordItem } from '@/types/attendance';
import { FeedbackSection } from '@/components/FeedbackSection';
import { LeaveRequestSection } from '@/components/LeaveRequestSection';
import { StatusBadge } from '@/components/StatusBadge';
import { CustomButton } from '@/components/CustomButton';
import { BottomNavigation } from '@/components/BottomNavigation';
import { EmptyState } from '@/components/EmptyState';
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
  APP_FONTS,
  APP_RADIUS,
  APP_SPACING,
  APP_SHADOWS,
} from '@/constants/theme';

interface StudentHomeScreenProps {
  navigation: NavigationProp;
}

export const StudentHomeScreen: React.FC<StudentHomeScreenProps> = ({
  navigation,
}) => {
  const {
    activeUser,
    activeScheduleId,
    setActiveScheduleId,
  } = useApp();
  const { schedules, loading: schedulesLoading, error: schedulesError } =
    useFirestoreSchedules(activeUser.id, 'student');
  const activeSchedule =
    schedules.find((schedule) => schedule.id === activeScheduleId) || schedules[0];

  const currentSchedule = activeSchedule || schedules[0];

  const attendanceSubKey =
    currentSchedule?.id && activeUser?.id
      ? `${currentSchedule.id}_${activeUser.id}`
      : '';
  const [attendanceState, setAttendanceState] = useState<{
    key: string;
    record: AttendanceRecordItem | null;
  }>({ key: '', record: null });

  useEffect(() => {
    if (!attendanceSubKey || !currentSchedule?.id || !activeUser?.id) {
      return undefined;
    }
    const activeKey = attendanceSubKey;
    const unsubscribe = subscribeToStudentAttendanceForSchedule(
      currentSchedule.id,
      activeUser.id,
      (record) => setAttendanceState({ key: activeKey, record }),
      (err) => console.warn('Attendance listener error:', err),
    );
    return () => {
      unsubscribe();
    };
  }, [attendanceSubKey, currentSchedule?.id, activeUser?.id]);

  const [feedbackModal, setFeedbackModal] = useState<{
    visible: boolean;
    success: boolean;
    message: string;
    timestamp?: string;
  }>({
    visible: false,
    success: false,
    message: '',
  });

  const studentRecord =
    attendanceSubKey && attendanceState.key === attendanceSubKey
      ? attendanceState.record
      : null;

  const isPresent = studentRecord?.status === 'Hadir';
  const isExcused = studentRecord?.status === 'Izin';
  const isSessionOpen = currentSchedule?.status === 'DIBUKA';

  const userInitials = (activeUser.name || 'M')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const handleAttendancePress = () => {
    if (!currentSchedule) return;
    navigation.navigate('StudentAttendance', {
      scheduleId: currentSchedule.id,
    });
  };

  const renderTopBar = () => (
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
            Praktikan · NIM {activeUser.nim || '-'}
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
  );

  if (schedulesLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <View style={styles.loadingScreen}>
          {renderTopBar()}
          <View style={styles.centeredState}>
            <ActivityIndicator size="large" color={APP_COLORS.primary} />
            <Text style={styles.emptyTitle}>Memuat jadwal...</Text>
          </View>
        </View>
        <BottomNavigation
          role="student"
          activeTab="StudentHome"
          onTabChange={(tabKey) => navigation.navigate(tabKey)}
        />
      </SafeAreaView>
    );
  }

  if (schedulesError || !currentSchedule) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <View style={styles.loadingScreen}>
          {renderTopBar()}
          <View style={styles.centeredState}>
            <EmptyState
              icon="calendar-outline"
              title={
                schedulesError
                  ? 'Jadwal Belum Tersedia'
                  : 'Belum Ada Jadwal'
              }
              description={
                schedulesError ||
                'Akun Anda belum didaftarkan ke jadwal praktikum.'
              }
            />
          </View>
        </View>
        <BottomNavigation
          role="student"
          activeTab="StudentHome"
          onTabChange={(tabKey) => navigation.navigate(tabKey)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {renderTopBar()}

        <View style={styles.sectionHeader}>
          <Text style={styles.screenTitle}>Jadwal Hari Ini</Text>
          <Pressable
            onPress={() => navigation.navigate('ScheduleList')}
            hitSlop={6}
            style={({ pressed }) => [styles.linkAction, pressed && styles.pressed]}>
            <Text style={styles.linkActionText}>Lihat Semua</Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={APP_COLORS.primary}
            />
          </Pressable>
        </View>

        {/* Pemilih Sesi Praktikum (sinkron dengan presensi & izin) */}
        {schedules.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scheduleTabsRow}>
            {schedules.map((item) => {
              const isSelected = item.id === currentSchedule?.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setActiveScheduleId(item.id)}
                  style={[
                    styles.scheduleChip,
                    isSelected && styles.scheduleChipActive,
                  ]}>
                  <Text
                    style={[
                      styles.scheduleChipTitle,
                      isSelected && styles.scheduleChipTitleActive,
                    ]}
                    numberOfLines={1}>
                    {item.courseName}
                  </Text>
                  <Text
                    style={[
                      styles.scheduleChipSub,
                      isSelected && styles.scheduleChipSubActive,
                    ]}>
                    {item.className} · {item.date}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Single Hero Card Sesi Aktif / Terpilih (#273287 + #D8E63C) */}
        <View style={styles.heroCard}>
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
              color="rgba(255,255,255,0.88)"
            />
            <Text style={styles.heroMetaText}>
              {currentSchedule.time} · {currentSchedule.room} · {currentSchedule.date}
            </Text>
          </View>

          <View style={styles.heroDivider} />

          {isPresent ? (
            <View style={styles.statusBoxPresent}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={APP_COLORS.opened}
              />
              <Text style={styles.statusBoxPresentText}>
                Hadir · {studentRecord?.timestamp}
              </Text>
            </View>
          ) : isExcused ? (
            <View style={styles.statusBoxExcused}>
              <Ionicons
                name="document-text"
                size={18}
                color={APP_COLORS.warning}
              />
              <Text style={styles.statusBoxExcusedText}>
                Izin Disetujui · {studentRecord?.date}
              </Text>
            </View>
          ) : isSessionOpen ? (
            <CustomButton
              title="Presensi Sekarang"
              variant="accent"
              size="md"
              leftIcon={
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={APP_COLORS.tetsuKon}
                />
              }
              onPress={handleAttendancePress}
            />
          ) : (
            <View style={styles.heroDisabledPill}>
              <Ionicons
                name="lock-closed-outline"
                size={15}
                color="rgba(255,255,255,0.85)"
              />
              <Text style={styles.heroDisabledText}>
                {currentSchedule.status === 'BELUM_DIBUKA'
                  ? 'Sesi belum dibuka asisten'
                  : 'Sesi presensi telah ditutup'}
              </Text>
            </View>
          )}
        </View>

        {/* Pengajuan & Status Izin Ringkas */}
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

        {/* Pesan & Kesan setelah praktikum SELESAI */}
        {currentSchedule.status === 'SELESAI' && (
          <FeedbackSection
            scheduleId={currentSchedule.id}
            isSessionFinished={true}
            studentId={activeUser.id}
            studentName={activeUser.name}
          />
        )}

        <View style={styles.sectionDivider} />

        {/* Daftar Sesi */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeading}>Daftar Sesi</Text>
          <Text style={styles.countLabel}>{schedules.length} sesi</Text>
        </View>

        <View style={styles.scheduleList}>
          {schedules.map((item, idx) => {
            const isSelected = item.id === currentSchedule?.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  setActiveScheduleId(item.id);
                  navigation.navigate('SessionDetail', { scheduleId: item.id });
                }}
                style={({ pressed }) => [
                  styles.scheduleCard,
                  idx % 2 === 1 && !isSelected && styles.scheduleCardTint,
                  isSelected && styles.scheduleCardSelected,
                  pressed && styles.pressed,
                ]}>
                <View style={styles.scheduleRowTop}>
                  <View style={styles.courseInfoCol}>
                    <Text style={styles.courseNameText} numberOfLines={1}>
                      {item.courseName}
                    </Text>
                    <Text style={styles.courseMetaText} numberOfLines={1}>
                      {item.className} · {item.room} · {item.date}
                    </Text>
                  </View>
                  <StatusBadge status={item.status} size="sm" />
                </View>

                <View style={styles.scheduleFooter}>
                  <Text style={styles.tapHint}>Ketuk untuk detail</Text>
                  <View style={styles.timePill}>
                    <Text style={styles.timePillText}>{item.time}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Feedback Modal Presensi */}
      <Modal
        visible={feedbackModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setFeedbackModal((prev) => ({ ...prev, visible: false }))
        }>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, APP_SHADOWS.modal]}>
            <View
              style={[
                styles.feedbackIconBox,
                feedbackModal.success
                  ? styles.feedbackSuccessBox
                  : styles.feedbackErrorBox,
              ]}>
              <Ionicons
                name={feedbackModal.success ? 'checkmark-circle' : 'alert-circle'}
                size={36}
                color={
                  feedbackModal.success ? APP_COLORS.opened : APP_COLORS.danger
                }
              />
            </View>
            <Text style={styles.modalFeedbackTitle}>
              {feedbackModal.success ? 'Presensi Berhasil' : 'Presensi Gagal'}
            </Text>
            <Text style={styles.modalFeedbackMessage}>
              {feedbackModal.message}
            </Text>
            {feedbackModal.timestamp ? (
              <View style={styles.modalTimeBox}>
                <Ionicons name="time-outline" size={15} color={APP_COLORS.primary} />
                <Text style={styles.modalTimeText}>
                  {feedbackModal.timestamp}
                </Text>
              </View>
            ) : null}
            <CustomButton
              title="Tutup"
              variant="primary"
              size="md"
              onPress={() =>
                setFeedbackModal((prev) => ({ ...prev, visible: false }))
              }
            />
          </View>
        </View>
      </Modal>

      <BottomNavigation
        role="student"
        activeTab="StudentHome"
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
  loadingScreen: {
    flex: 1,
    paddingHorizontal: APP_SPACING.lg,
    paddingTop: APP_SPACING.sm,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: APP_SPACING.md,
  },
  emptyTitle: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 15,
    color: APP_COLORS.inkPrimary,
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
  countLabel: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
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
  scheduleTabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: APP_SPACING.md,
  },
  scheduleChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    minWidth: 150,
  },
  scheduleChipActive: {
    backgroundColor: APP_COLORS.primary,
    borderColor: APP_COLORS.primary,
  },
  scheduleChipTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 13,
    color: APP_COLORS.inkPrimary,
  },
  scheduleChipTitleActive: {
    color: APP_COLORS.white,
  },
  scheduleChipSub: {
    fontFamily: APP_FONTS.medium,
    fontSize: 11,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
  },
  scheduleChipSubActive: {
    color: APP_COLORS.nordicBreeze,
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
  statusBoxPresent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: APP_COLORS.openedSoft,
    borderRadius: APP_RADIUS.md,
    minHeight: 44,
    paddingHorizontal: APP_SPACING.md,
  },
  statusBoxPresentText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 13,
    color: APP_COLORS.opened,
  },
  statusBoxExcused: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: APP_COLORS.warningBg,
    borderRadius: APP_RADIUS.md,
    minHeight: 44,
    paddingHorizontal: APP_SPACING.md,
  },
  statusBoxExcusedText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 13,
    color: APP_COLORS.warning,
  },
  heroDisabledPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: APP_RADIUS.md,
    minHeight: 44,
    paddingHorizontal: APP_SPACING.md,
  },
  heroDisabledText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.88)',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: APP_COLORS.border,
    marginVertical: APP_SPACING.lg,
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
  scheduleRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: APP_SPACING.sm,
    marginBottom: APP_SPACING.sm,
  },
  courseInfoCol: {
    flex: 1,
  },
  courseNameText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 15,
    color: APP_COLORS.inkPrimary,
    marginBottom: 2,
  },
  courseMetaText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  scheduleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tapHint: {
    fontFamily: APP_FONTS.regular,
    fontSize: 12,
    color: APP_COLORS.textMuted,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 24, 75, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: APP_SPACING.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.modal,
    padding: APP_SPACING.xl,
    alignItems: 'center',
  },
  feedbackIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: APP_SPACING.md,
  },
  feedbackSuccessBox: {
    backgroundColor: APP_COLORS.openedSoft,
  },
  feedbackErrorBox: {
    backgroundColor: APP_COLORS.dangerSoft,
  },
  modalFeedbackTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 18,
    color: APP_COLORS.inkPrimary,
    marginBottom: 6,
  },
  modalFeedbackMessage: {
    fontFamily: APP_FONTS.regular,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: APP_SPACING.md,
  },
  modalTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: APP_COLORS.softBlue,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: APP_RADIUS.sm,
    marginBottom: APP_SPACING.lg,
  },
  modalTimeText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.primary,
  },
  pressed: {
    opacity: 0.78,
  },
});

export default StudentHomeScreen;
