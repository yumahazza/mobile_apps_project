import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { useFirestoreSchedules } from '@/hooks/useFirestoreSchedules';
import {
  openPracticumSession,
  closePracticumSession,
  subscribeToSingleSchedule,
} from '@/services/sessionControlService';
import type { PracticumSchedule } from '@/services/practicumScheduleService';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmModal } from '@/components/ConfirmModal';
import { AppHeader } from '@/components/AppHeader';
import { BottomNavigation } from '@/components/BottomNavigation';
import { CustomButton } from '@/components/CustomButton';
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
  APP_FONTS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

interface SessionControlScreenProps {
  navigation: NavigationProp;
}

export const SessionControlScreen: React.FC<SessionControlScreenProps> = ({
  navigation,
}) => {
  const {
    activeScheduleId,
    setActiveScheduleId,
    activeUser,
    activeRole,
  } = useApp();

  const {
    schedules,
    loading: schedulesLoading,
    error: schedulesError,
  } = useFirestoreSchedules(activeUser.id, 'assistant');

  const [selectedId, setSelectedId] = useState<string>(
    navigation.params?.scheduleId || activeScheduleId || '',
  );

  const selectedFromList =
    schedules.find((s) => s.id === selectedId) ||
    schedules.find((s) => s.id === navigation.params?.scheduleId) ||
    schedules.find((s) => s.id === activeScheduleId) ||
    schedules[0];

  const targetScheduleId = selectedFromList?.id || '';

  const [realtimeState, setRealtimeState] = useState<{
    id: string;
    schedule: PracticumSchedule | null;
  }>({ id: '', schedule: null });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!targetScheduleId) return undefined;
    const activeId = targetScheduleId;
    const unsubscribe = subscribeToSingleSchedule(
      activeId,
      (schedule) => setRealtimeState({ id: activeId, schedule }),
      (err) => {
        console.warn('Realtime schedule subscription error:', err);
      },
    );
    return () => unsubscribe();
  }, [targetScheduleId]);

  const realtimeSchedule =
    targetScheduleId && realtimeState.id === targetScheduleId
      ? realtimeState.schedule
      : null;

  const currentSchedule = realtimeSchedule || selectedFromList;

  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    action: 'open' | 'close';
  }>({
    visible: false,
    action: 'open',
  });

  const handleConfirmAction = async () => {
    if (!currentSchedule) return;
    const action = confirmModal.action;
    setConfirmModal({ visible: false, action: 'open' });

    try {
      setIsSaving(true);
      if (action === 'open') {
        const result = await openPracticumSession(
          currentSchedule.id,
          activeUser.id,
        );
        Alert.alert('Sesi Dibuka', result.message);
      } else {
        const result = await closePracticumSession(
          currentSchedule.id,
          activeUser.id,
        );
        Alert.alert('Sesi Ditutup', result.message);
      }
    } catch (error) {
      Alert.alert(
        'Operasi Gagal',
        error instanceof Error
          ? error.message
          : 'Gagal memperbarui status sesi.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const isOpened = currentSchedule?.status === 'DIBUKA';
  const isFinished = currentSchedule?.status === 'SELESAI';
  const isNotOpened = currentSchedule?.status === 'BELUM_DIBUKA';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title="Kontrol Sesi"
        subtitle="Buka atau tutup presensi praktikum"
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {isSaving && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color={APP_COLORS.primary} />
            <Text style={styles.loadingBannerText}>Memperbarui sesi...</Text>
          </View>
        )}

        {schedulesLoading && !currentSchedule ? (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color={APP_COLORS.primary} />
            <Text style={styles.loadingBannerText}>Memuat jadwal...</Text>
          </View>
        ) : schedulesError && !currentSchedule ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Gagal Memuat Jadwal"
            description={schedulesError}
          />
        ) : !currentSchedule ? (
          <EmptyState
            icon="calendar-outline"
            title="Belum Ada Sesi"
            description="Buat jadwal praktikum di menu Jadwal."
          />
        ) : (
          <>
            {schedules.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scheduleTabsRow}>
                {schedules.map((item) => {
                  const isSelected = item.id === currentSchedule.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        setSelectedId(item.id);
                        setActiveScheduleId(item.id);
                      }}
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

            {/* Status Hero Card */}
            <View
              style={[
                styles.statusCard,
                isOpened && styles.statusCardOpen,
              ]}>
              <View style={styles.cardTopRow}>
                <View
                  style={[
                    styles.classPill,
                    isOpened && styles.classPillDark,
                  ]}>
                  <Text
                    style={[
                      styles.classPillText,
                      isOpened && styles.classPillTextDark,
                    ]}>
                    {currentSchedule.className}
                  </Text>
                </View>
                <StatusBadge status={currentSchedule.status} size="sm" />
              </View>

              <Text
                style={[
                  styles.courseName,
                  isOpened && styles.courseNameOpen,
                ]}>
                {currentSchedule.courseName}
              </Text>

              <Text
                style={[
                  styles.courseMeta,
                  isOpened && styles.courseMetaOpen,
                ]}>
                {currentSchedule.time} · {currentSchedule.room} · {currentSchedule.date}
              </Text>

              <View
                style={[
                  styles.divider,
                  isOpened && styles.dividerOpen,
                ]}
              />

              <Text
                style={[
                  styles.statusDescText,
                  isOpened && styles.statusDescTextOpen,
                ]}>
                {isOpened
                  ? 'Sesi aktif. Praktikan terdaftar dapat mengirim presensi.'
                  : isNotOpened
                  ? 'Sesi belum dimulai. Buka sesi agar presensi aktif.'
                  : 'Sesi selesai. Presensi ditutup dan ulasan dibuka.'}
              </Text>
            </View>

            {/* Tombol Kontrol Sesi */}
            <View style={styles.actionContainer}>
              {isNotOpened && (
                <CustomButton
                  title="Buka Sesi Presensi"
                  variant="primary"
                  size="lg"
                  loading={isSaving}
                  disabled={isSaving || schedulesLoading}
                  leftIcon={
                    <Ionicons
                      name="play-circle-outline"
                      size={18}
                      color={APP_COLORS.white}
                    />
                  }
                  onPress={() => setConfirmModal({ visible: true, action: 'open' })}
                />
              )}

              {isOpened && (
                <CustomButton
                  title="Tutup & Selesaikan Sesi"
                  variant="danger"
                  size="lg"
                  loading={isSaving}
                  disabled={isSaving || schedulesLoading}
                  leftIcon={
                    <Ionicons
                      name="stop-circle-outline"
                      size={18}
                      color={APP_COLORS.white}
                    />
                  }
                  onPress={() => setConfirmModal({ visible: true, action: 'close' })}
                />
              )}

              {isFinished && (
                <View style={styles.finishedBox}>
                  <Ionicons
                    name="checkmark-done-circle"
                    size={18}
                    color={APP_COLORS.opened}
                  />
                  <Text style={styles.finishedText}>Sesi Selesai</Text>
                </View>
              )}
            </View>

            {/* Catatan Singkat */}
            <View style={styles.infoCallout}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={APP_COLORS.primary}
              />
              <Text style={styles.infoCalloutText}>
                Perubahan status bersifat satu arah dan tidak dapat dibuka ulang setelah ditutup.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.action === 'open' ? 'Buka Sesi?' : 'Tutup Sesi?'}
        subtitle={
          confirmModal.action === 'open'
            ? 'Praktikan dapat langsung melakukan presensi.'
            : 'Presensi akan ditutup setelah sesi berakhir.'
        }
        details={{
          courseName: currentSchedule?.courseName,
          className: currentSchedule?.className,
          time: currentSchedule?.time,
          room: currentSchedule?.room,
        }}
        confirmText={confirmModal.action === 'open' ? 'Ya, Buka' : 'Tutup Sesi'}
        cancelText="Batal"
        confirmVariant={confirmModal.action === 'open' ? 'primary' : 'danger'}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmModal({ visible: false, action: 'open' })}
      />

      <BottomNavigation
        role={activeRole}
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
    paddingTop: APP_SPACING.xs,
    paddingBottom: APP_SPACING.xxl,
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
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_SPACING.sm,
    backgroundColor: APP_COLORS.white,
    padding: APP_SPACING.md,
    borderRadius: APP_RADIUS.card,
    marginBottom: APP_SPACING.md,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  loadingBannerText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: APP_COLORS.inkPrimary,
  },
  statusCard: {
    padding: APP_SPACING.xl,
    borderRadius: APP_RADIUS.hero,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.lg,
  },
  statusCardOpen: {
    backgroundColor: APP_COLORS.intergalactic,
    borderColor: APP_COLORS.intergalactic,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: APP_SPACING.md,
  },
  classPill: {
    backgroundColor: APP_COLORS.nordicBreeze,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: APP_RADIUS.pill,
  },
  classPillDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  classPillText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.inkPrimary,
  },
  classPillTextDark: {
    color: APP_COLORS.white,
  },
  courseName: {
    fontFamily: APP_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
    color: APP_COLORS.inkPrimary,
    marginBottom: 4,
  },
  courseNameOpen: {
    color: APP_COLORS.durantaYellow,
  },
  courseMeta: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  courseMetaOpen: {
    color: 'rgba(255, 255, 255, 0.88)',
  },
  divider: {
    height: 1,
    backgroundColor: APP_COLORS.divider,
    marginVertical: APP_SPACING.md,
  },
  dividerOpen: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  statusDescText: {
    fontFamily: APP_FONTS.regular,
    fontSize: 14,
    color: APP_COLORS.textSecondary,
    lineHeight: 20,
  },
  statusDescTextOpen: {
    color: APP_COLORS.white,
  },
  actionContainer: {
    marginBottom: APP_SPACING.lg,
  },
  finishedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: APP_RADIUS.md,
    minHeight: 48,
    paddingVertical: 12,
  },
  finishedText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
  },
  infoCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_SPACING.sm,
    backgroundColor: APP_COLORS.softBlue,
    borderRadius: APP_RADIUS.md,
    padding: APP_SPACING.md,
  },
  infoCalloutText: {
    flex: 1,
    fontFamily: APP_FONTS.regular,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    lineHeight: 18,
  },
});

export default SessionControlScreen;
