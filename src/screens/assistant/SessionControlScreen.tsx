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
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
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

  // Berlangganan dokumen jadwal spesifik di Firestore secara real-time
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
          : 'Gagal memperbarui status sesi di Firestore.',
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
        subtitle="Buka & tutup sesi presensi real-time"
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {isSaving && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color={APP_COLORS.primary} />
            <Text style={styles.loadingBannerText}>
              Memperbarui status sesi di Cloud Firestore...
            </Text>
          </View>
        )}

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
            {/* Pemilih Sesi Horizontal */}
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
                        {item.className} • {item.date}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* Bento Hero Status Card */}
            <View
              style={[
                styles.heroCard,
                isOpened
                  ? styles.heroCardOpen
                  : isNotOpened
                  ? styles.heroCardWaiting
                  : styles.heroCardFinished,
              ]}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroIconCircle}>
                  <Ionicons
                    name={
                      isOpened
                        ? 'radio-outline'
                        : isNotOpened
                        ? 'time-outline'
                        : 'checkmark-done-outline'
                    }
                    size={22}
                    color="#0F172A"
                  />
                </View>
                <StatusBadge status={currentSchedule.status} size="md" />
              </View>

              <Text style={styles.courseName}>
                {currentSchedule.courseName}
              </Text>

              <View style={styles.tagRow}>
                <View style={styles.tagPill}>
                  <Text style={styles.tagPillText}>
                    {currentSchedule.className}
                  </Text>
                </View>
                <View style={styles.tagPill}>
                  <Text style={styles.tagPillText}>{currentSchedule.room}</Text>
                </View>
                <View style={styles.tagPill}>
                  <Text style={styles.tagPillText}>{currentSchedule.time}</Text>
                </View>
              </View>

              <Text style={styles.statusDescText}>
                {isOpened
                  ? 'Sesi sedang berlangsung. Praktikan yang terdaftar dapat mengirim presensi kehadiran sekarang.'
                  : isNotOpened
                  ? 'Sesi belum dimulai. Tekan tombol Buka Sesi di bawah agar praktikan dapat melakukan presensi.'
                  : 'Sesi telah ditutup & selesai. Presensi dinonaktifkan dan form ulasan praktikum telah dibuka.'}
              </Text>
            </View>

            {/* Action Buttons Section */}
            <View style={styles.actionButtonsContainer}>
              {isNotOpened && (
                <Pressable
                  disabled={isSaving || schedulesLoading}
                  onPress={handleOpenModal}
                  style={({ pressed }) => [
                    styles.primaryActionBtn,
                    pressed && styles.pressed,
                  ]}>
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="play" size={18} color="#FFFFFF" />
                      <Text style={styles.primaryActionBtnText}>
                        Buka Sesi Presensi Sekarang
                      </Text>
                    </>
                  )}
                </Pressable>
              )}

              {isOpened && (
                <Pressable
                  disabled={isSaving || schedulesLoading}
                  onPress={handleCloseModal}
                  style={({ pressed }) => [
                    styles.dangerActionBtn,
                    pressed && styles.pressed,
                  ]}>
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="power-outline"
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.primaryActionBtnText}>
                        Tutup & Selesaikan Sesi
                      </Text>
                    </>
                  )}
                </Pressable>
              )}

              {isFinished && (
                <View style={styles.finishedPillBox}>
                  <Ionicons
                    name="checkmark-done-circle"
                    size={18}
                    color="#0F172A"
                  />
                  <Text style={styles.finishedPillText}>
                    Sesi Telah Selesai & Dikunci
                  </Text>
                </View>
              )}
            </View>

            {/* Info Callout Box */}
            <View style={styles.infoCallout}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color="#0F172A"
                style={styles.infoIcon}
              />
              <Text style={styles.infoCalloutText}>
                Transisi status sesi bersifat satu arah (BELUM_DIBUKA → DIBUKA →
                SELESAI). Setelah ditutup, sesi tidak dapat dibuka kembali.
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
    backgroundColor: '#F5F6FA',
  },
  scrollContent: {
    paddingHorizontal: APP_SPACING.lg,
    paddingTop: APP_SPACING.sm,
    paddingBottom: APP_SPACING.xxl,
  },
  scheduleTabsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 14,
  },
  scheduleChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0F172A',
    minWidth: 155,
  },
  scheduleChipActive: {
    backgroundColor: '#0F172A',
  },
  scheduleChipTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  scheduleChipTitleActive: {
    color: '#FFFFFF',
  },
  scheduleChipSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  scheduleChipSubActive: {
    color: '#CBD5E1',
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_SPACING.sm,
    backgroundColor: '#FFFFFF',
    padding: APP_SPACING.md,
    borderRadius: 16,
    marginBottom: APP_SPACING.md,
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  loadingBannerText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  heroCard: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#0F172A',
    marginBottom: 18,
  },
  heroCardOpen: {
    backgroundColor: '#86EFAC',
  },
  heroCardWaiting: {
    backgroundColor: '#FDE68A',
  },
  heroCardFinished: {
    backgroundColor: '#E2E8F0',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heroIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseName: {
    fontSize: 21,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 10,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  tagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#0F172A',
  },
  tagPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusDescText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 19,
  },
  actionButtonsContainer: {
    marginBottom: 18,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    borderRadius: 999,
    paddingVertical: 15,
    minHeight: 52,
  },
  dangerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    borderRadius: 999,
    paddingVertical: 15,
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  finishedPillBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0F172A',
    borderRadius: 999,
    paddingVertical: 14,
  },
  finishedPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  infoCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0F172A',
    borderRadius: 18,
    padding: 14,
  },
  infoIcon: {
    marginRight: 10,
  },
  infoCalloutText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.8,
  },
});

export default SessionControlScreen;
