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
import {
  openPracticumSession,
  closePracticumSession,
  subscribeToSingleSchedule,
} from '@/services/sessionControlService';
import type { PracticumSchedule } from '@/services/practicumScheduleService';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { CustomButton } from '@/components/CustomButton';
import { ConfirmModal } from '@/components/ConfirmModal';
import { AppHeader } from '@/components/AppHeader';
import { BottomNavigation } from '@/components/BottomNavigation';
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
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
    activeUser,
    activeRole,
  } = useApp();

  const { schedules, loading: schedulesLoading, error: schedulesError } =
    useFirestoreSchedules(activeUser.id, 'assistant');

  const selectedFromList =
    schedules.find(s => s.id === navigation.params?.scheduleId) ||
    schedules.find(s => s.id === activeScheduleId) ||
    schedules[0];

  const targetScheduleId =
    navigation.params?.scheduleId || selectedFromList?.id || '';

  const [realtimeState, setRealtimeState] = useState<{
    id: string;
    schedule: PracticumSchedule | null;
  }>({ id: '', schedule: null });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Berlangganan dokumen jadwal spesifik di Firestore secara real-time
  useEffect(() => {
    if (!targetScheduleId) return undefined;
    const activeId = targetScheduleId;
    const unsubscribe = subscribeToSingleSchedule(
      activeId,
      schedule => setRealtimeState({ id: activeId, schedule }),
      err => {
        // Fallback jika listener gagal
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

  const handleOpenModal = () => {
    setConfirmModal({ visible: true, action: 'open' });
  };

  const handleCloseModal = () => {
    setConfirmModal({ visible: true, action: 'close' });
  };

  const handleConfirmAction = async () => {
    if (!currentSchedule) return;
    const action = confirmModal.action;
    setConfirmModal({ visible: false, action: 'open' });

    try {
      setIsSaving(true);
      if (action === 'open') {
        const result = await openPracticumSession(currentSchedule.id, activeUser.id);
        Alert.alert('Sesi Dibuka', result.message);
      } else {
        const result = await closePracticumSession(currentSchedule.id, activeUser.id);
        Alert.alert('Sesi Ditutup', result.message);
      }
    } catch (error) {
      Alert.alert(
        'Operasi Gagal',
        error instanceof Error ? error.message : 'Gagal memperbarui status sesi di Firestore.',
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
      {/* Top Academic Blue Header */}
      <AppHeader
        title="Kontrol Sesi"
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Loading Banner when Firestore is updating */}
        {isSaving && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color={APP_COLORS.primary} />
            <Text style={styles.loadingBannerText}>
              Memperbarui status sesi di Cloud Firestore...
            </Text>
          </View>
        )}

        {/* Empty / Loading / Error State when no schedule */}
        {schedulesLoading && !currentSchedule ? (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color={APP_COLORS.primary} />
            <Text style={styles.loadingBannerText}>
              Memuat jadwal sesi dari Cloud Firestore...
            </Text>
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
            title="Belum Ada Sesi Praktikum"
            description="Buat jadwal praktikum terlebih dahulu di menu Jadwal sebelum membuka sesi presensi."
          />
        ) : (
          <>
            {/* Session Info Card */}
            <Card style={styles.sessionCard}>
              <View style={styles.sessionRow}>
                <View style={styles.sessionIconBox}>
                  <Ionicons name="lock-closed" size={18} color={APP_COLORS.primary} />
                </View>
                <View style={styles.sessionTextCol}>
                  <Text style={styles.courseName}>{currentSchedule.courseName}</Text>
                  <Text style={styles.sessionMeta}>
                    {currentSchedule.time} | {currentSchedule.room}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Status Sesi Card */}
            <Card style={styles.statusCard}>
              <Text style={styles.statusCardTitle}>Status Sesi</Text>
              <View style={styles.statusBadgeRow}>
                <StatusBadge status={currentSchedule.status} size="md" />
              </View>
              <Text style={styles.statusDescText}>
                {isOpened
                  ? 'Sesi sedang berlangsung. Praktikan dapat melakukan presensi.'
                  : isNotOpened
                  ? 'Sesi belum dimulai. Praktikan belum dapat melakukan presensi.'
                  : 'Sesi telah ditutup & selesai. Presensi telah dinonaktifkan.'}
              </Text>
            </Card>

            {/* Action Buttons Section */}
            <View style={styles.actionButtonsContainer}>
              {isNotOpened && (
                <CustomButton
                  title={isSaving ? 'Menyimpan...' : 'Buka Sesi'}
                  variant="primary"
                  size="lg"
                  disabled={isSaving || schedulesLoading}
                  leftIcon={
                    isSaving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="play" size={18} color={APP_COLORS.white} />
                    )
                  }
                  onPress={handleOpenModal}
                />
              )}

              {isOpened && (
                <CustomButton
                  title={isSaving ? 'Menyimpan...' : 'Tutup & Selesaikan Sesi'}
                  variant="danger"
                  size="lg"
                  disabled={isSaving || schedulesLoading}
                  leftIcon={
                    isSaving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="power-outline" size={18} color={APP_COLORS.white} />
                    )
                  }
                  onPress={handleCloseModal}
                />
              )}

              {isFinished && (
                <CustomButton
                  title="Sesi Telah Selesai"
                  variant="outline"
                  disabled
                  size="lg"
                  leftIcon={
                    <Ionicons
                      name="checkmark-done"
                      size={18}
                      color={APP_COLORS.neutral500}
                    />
                  }
                  onPress={() => {}}
                />
              )}
            </View>

            {/* Blue Info Callout Box */}
            <View style={styles.infoCallout}>
              <Ionicons
                name="information-circle"
                size={20}
                color={APP_COLORS.primary}
                style={styles.infoIcon}
              />
              <Text style={styles.infoCalloutText}>
                Setelah sesi ditutup, presensi tidak dapat dilakukan lagi oleh praktikan.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Confirmation Modal */}
      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.action === 'open' ? 'Buka Sesi?' : 'Tutup Sesi?'}
        subtitle={
          confirmModal.action === 'open'
            ? 'Praktikan akan dapat melakukan presensi kehadiran setelah sesi dibuka.'
            : 'Setelah sesi ditutup, praktikan tidak dapat melakukan presensi lagi.'
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

      {/* Bottom Navigation */}
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
    paddingTop: APP_SPACING.md,
    paddingBottom: APP_SPACING.xl,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_SPACING.sm,
    backgroundColor: APP_COLORS.softBlue,
    padding: APP_SPACING.md,
    borderRadius: APP_RADIUS.card,
    marginBottom: APP_SPACING.md,
    borderWidth: 1,
    borderColor: APP_COLORS.lightBlue,
  },
  loadingBannerText: {
    fontSize: 13,
    color: APP_COLORS.primary,
    fontWeight: '600',
  },
  sessionCard: {
    padding: APP_SPACING.md,
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
  sessionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: APP_COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_SPACING.md,
  },
  sessionTextCol: {
    flex: 1,
  },
  courseName: {
    fontSize: 15,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
    marginBottom: 2,
  },
  sessionMeta: {
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  statusCard: {
    padding: APP_SPACING.lg,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.lg,
  },
  statusCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
    marginBottom: APP_SPACING.sm,
  },
  statusBadgeRow: {
    marginVertical: 4,
  },
  statusDescText: {
    fontSize: 13,
    color: APP_COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  actionButtonsContainer: {
    gap: APP_SPACING.sm,
    marginBottom: APP_SPACING.lg,
  },
  secondaryActionBtn: {
    marginTop: 2,
  },
  infoCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_COLORS.softBlue,
    borderWidth: 1,
    borderColor: APP_COLORS.lightBlue,
    borderRadius: 10,
    padding: APP_SPACING.md,
  },
  infoIcon: {
    marginRight: APP_SPACING.sm,
  },
  infoCalloutText: {
    flex: 1,
    fontSize: 12,
    color: APP_COLORS.textPrimary,
    lineHeight: 18,
  },
});

export default SessionControlScreen;
