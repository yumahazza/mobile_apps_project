/**
 * LeaveRequestScreen
 * Form pengajuan izin & pemantauan status izin praktikan yang sinkron dengan sesi terpilih.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { useFirestoreSchedules } from '@/hooks/useFirestoreSchedules';
import { useStudentLeaveRequests } from '@/hooks/useRealtimeLeaveRequests';
import {
  submitLeaveRequest,
  validateLeaveReason,
} from '@/services/leaveRequestService';
import { Card } from '@/components/Card';
import { CustomButton } from '@/components/CustomButton';
import { StatusBadge } from '@/components/StatusBadge';
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

interface LeaveRequestScreenProps {
  navigation: NavigationProp;
}

type HistoryFilter = 'SELECTED' | 'ALL';

export const LeaveRequestScreen: React.FC<LeaveRequestScreenProps> = ({
  navigation,
}) => {
  const { activeUser, activeScheduleId, setActiveScheduleId } = useApp();
  const {
    schedules,
    loading: schedulesLoading,
    error: schedulesError,
  } = useFirestoreSchedules(activeUser.id, 'student');
  const {
    leaveRequests,
    loading: leavesLoading,
  } = useStudentLeaveRequests(activeUser.id);

  const requestedScheduleId = navigation.params?.scheduleId;
  const [manualSelection, setManualSelection] = useState<{
    paramKey?: string;
    scheduleId: string;
  } | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('SELECTED');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const selectedScheduleId =
    manualSelection && manualSelection.paramKey === requestedScheduleId
      ? manualSelection.scheduleId
      : requestedScheduleId || activeScheduleId || '';

  const currentSchedule =
    schedules.find((s) => s.id === selectedScheduleId) ||
    (requestedScheduleId
      ? schedules.find((s) => s.id === requestedScheduleId)
      : schedules.find((s) => s.id === activeScheduleId)) ||
    schedules[0];

  const existingLeaveForSelected = currentSchedule
    ? leaveRequests.find((req) => req.scheduleId === currentSchedule.id)
    : undefined;

  const isSessionFinished = currentSchedule?.status === 'SELESAI';

  const displayedLeaves = useMemo(() => {
    if (historyFilter === 'ALL' || !currentSchedule) {
      return leaveRequests;
    }
    return leaveRequests.filter((item) => item.scheduleId === currentSchedule.id);
  }, [historyFilter, leaveRequests, currentSchedule]);

  const handleSubmit = async () => {
    if (!currentSchedule) {
      Alert.alert('Validasi', 'Pilih sesi praktikum terlebih dahulu.');
      return;
    }

    const validationError = validateLeaveReason(reason);
    if (validationError) {
      Alert.alert('Validasi Alasan Izin', validationError);
      return;
    }

    try {
      setSubmitting(true);
      const res = await submitLeaveRequest({
        scheduleId: currentSchedule.id,
        courseName: currentSchedule.courseName,
        className: currentSchedule.className,
        studentId: activeUser.id,
        studentName: activeUser.name,
        nim: activeUser.nim,
        reason: reason.trim(),
      });
      setReason('');
      Alert.alert('Pengajuan Izin Terkirim', res.message);
    } catch (err) {
      Alert.alert(
        'Pengajuan Izin Gagal',
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan pengajuan izin.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title="Pengajuan Izin"
        subtitle={
          currentSchedule
            ? `${currentSchedule.courseName} · ${currentSchedule.className}`
            : 'Formulir & riwayat izin'
        }
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Pilih Sesi Praktikum</Text>
        {schedulesLoading ? (
          <Card style={styles.card}>
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={APP_COLORS.primary} />
              <Text style={styles.loadingText}>Memuat jadwal...</Text>
            </View>
          </Card>
        ) : schedulesError ? (
          <Card style={styles.card}>
            <Text style={styles.loadingText}>{schedulesError}</Text>
          </Card>
        ) : schedules.length === 0 ? (
          <Card style={styles.card}>
            <Text style={styles.loadingText}>
              Belum ada jadwal praktikum terdaftar.
            </Text>
          </Card>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scheduleTabsRow}>
            {schedules.map((item) => {
              const isSelected = item.id === currentSchedule?.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setManualSelection({
                      paramKey: requestedScheduleId,
                      scheduleId: item.id,
                    });
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

        {/* Form atau Status Sesi Terpilih */}
        {currentSchedule && (
          <Card style={styles.formCard}>
            <View style={styles.formHeaderRow}>
              <View style={styles.formTitleCol}>
                <Text style={styles.courseTitle}>
                  {currentSchedule.courseName}
                </Text>
                <Text style={styles.courseMeta}>
                  {currentSchedule.className} · {currentSchedule.time} · {currentSchedule.room}
                </Text>
              </View>
              <StatusBadge status={currentSchedule.status} size="sm" />
            </View>

            {existingLeaveForSelected ? (
              <View style={styles.alreadySubmittedBox}>
                <View style={styles.alreadySubmittedRow}>
                  <Text style={styles.alreadySubmittedTitle}>
                    Status Izin Sesi Ini
                  </Text>
                  <StatusBadge
                    status={existingLeaveForSelected.status}
                    size="sm"
                  />
                </View>
                <Text style={styles.alreadySubmittedDesc}>
                  Pengajuan sudah tercatat untuk {currentSchedule.courseName}.
                </Text>
              </View>
            ) : isSessionFinished ? (
              <View style={styles.alreadySubmittedBox}>
                <Text style={styles.alreadySubmittedDesc}>
                  Sesi selesai. Pengajuan izin sudah ditutup.
                </Text>
              </View>
            ) : (
              <View style={styles.formBody}>
                <Text style={styles.inputLabel}>Alasan Ketidakhadiran *</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Contoh: Sakit demam, ada surat dokter..."
                  placeholderTextColor={APP_COLORS.neutral400}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  value={reason}
                  onChangeText={setReason}
                  editable={!submitting}
                  textAlignVertical="top"
                />
                <Text style={styles.charCounter}>
                  {reason.trim().length}/500
                </Text>

                <Text style={styles.manualNoteText}>
                  Status awal MENUNGGU dan diperiksa manual oleh asisten.
                </Text>

                <CustomButton
                  title={submitting ? 'Mengirim...' : 'Kirim Pengajuan Izin'}
                  variant="primary"
                  size="lg"
                  loading={submitting}
                  disabled={submitting}
                  leftIcon={
                    !submitting ? (
                      <Ionicons
                        name="paper-plane-outline"
                        size={17}
                        color={APP_COLORS.white}
                      />
                    ) : undefined
                  }
                  onPress={handleSubmit}
                />
              </View>
            )}
          </Card>
        )}

        {/* Daftar Status & Riwayat Pengajuan Izin */}
        <View style={styles.listHeaderRow}>
          <View style={styles.listTitleRow}>
            <Text style={styles.sectionTitle}>Riwayat Izin</Text>
            {leavesLoading && (
              <ActivityIndicator size="small" color={APP_COLORS.primary} />
            )}
          </View>

          <View style={styles.toggleGroup}>
            <Pressable
              onPress={() => setHistoryFilter('SELECTED')}
              style={[
                styles.toggleChip,
                historyFilter === 'SELECTED' && styles.toggleChipActive,
              ]}>
              <Text
                style={[
                  styles.toggleChipText,
                  historyFilter === 'SELECTED' && styles.toggleChipTextActive,
                ]}>
                Sesi Ini
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setHistoryFilter('ALL')}
              style={[
                styles.toggleChip,
                historyFilter === 'ALL' && styles.toggleChipActive,
              ]}>
              <Text
                style={[
                  styles.toggleChipText,
                  historyFilter === 'ALL' && styles.toggleChipTextActive,
                ]}>
                Semua ({leaveRequests.length})
              </Text>
            </Pressable>
          </View>
        </View>

        {displayedLeaves.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title="Belum Ada Pengajuan Izin"
            description={
              historyFilter === 'SELECTED' && currentSchedule
                ? `Belum ada pengajuan izin untuk ${currentSchedule.courseName}.`
                : 'Riwayat pengajuan izin Anda akan tampil di sini.'
            }
          />
        ) : (
          <View style={styles.leaveList}>
            {displayedLeaves.map((item) => {
              const matchedSchedule = schedules.find(
                (s) => s.id === item.scheduleId,
              );
              const courseTitle =
                matchedSchedule?.courseName ||
                item.courseName ||
                'Sesi Praktikum';
              const classSubtitle =
                matchedSchedule?.className || item.className || '';

              return (
                <Card key={item.id} style={styles.leaveItemCard}>
                  <View style={styles.leaveItemHeader}>
                    <View style={styles.leaveItemTitleCol}>
                      <Text style={styles.leaveCourseName} numberOfLines={1}>
                        {courseTitle}
                        {classSubtitle ? ` · ${classSubtitle}` : ''}
                      </Text>
                      <Text style={styles.leaveDateText}>{item.createdAt}</Text>
                    </View>
                    <StatusBadge status={item.status} size="sm" />
                  </View>

                  <View style={styles.leaveReasonBox}>
                    <Text style={styles.leaveReasonText}>“{item.reason}”</Text>
                  </View>

                  <Text style={styles.reviewerText}>
                    {item.reviewedBy
                      ? `Asisten: ${item.reviewedBy}${
                          item.reviewedAt ? ` · ${item.reviewedAt}` : ''
                        }`
                      : 'Menunggu review asisten'}
                  </Text>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

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
  scrollContent: {
    paddingHorizontal: APP_SPACING.lg,
    paddingTop: APP_SPACING.xs,
    paddingBottom: APP_SPACING.xxl,
  },
  sectionTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 16,
    color: APP_COLORS.inkPrimary,
    marginBottom: APP_SPACING.sm,
  },
  card: {
    padding: APP_SPACING.lg,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.md,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_SPACING.sm,
  },
  loadingText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
  },
  scheduleTabsRow: {
    gap: 8,
    paddingBottom: APP_SPACING.md,
  },
  scheduleChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
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
  formCard: {
    padding: APP_SPACING.lg,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.xl,
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: APP_SPACING.sm,
  },
  formTitleCol: {
    flex: 1,
  },
  courseTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 16,
    color: APP_COLORS.inkPrimary,
  },
  courseMeta: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
  },
  alreadySubmittedBox: {
    marginTop: APP_SPACING.md,
    padding: APP_SPACING.md,
    backgroundColor: APP_COLORS.softBlue,
    borderRadius: APP_RADIUS.md,
  },
  alreadySubmittedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  alreadySubmittedTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 13,
    color: APP_COLORS.primary,
  },
  alreadySubmittedDesc: {
    fontFamily: APP_FONTS.regular,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    lineHeight: 18,
  },
  formBody: {
    marginTop: APP_SPACING.md,
  },
  inputLabel: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 13,
    color: APP_COLORS.inkPrimary,
    marginBottom: 6,
  },
  textArea: {
    fontFamily: APP_FONTS.regular,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: APP_RADIUS.md,
    padding: APP_SPACING.md,
    minHeight: 92,
    fontSize: 14,
    lineHeight: 20,
    color: APP_COLORS.inkPrimary,
    backgroundColor: APP_COLORS.surfaceSubtle,
  },
  charCounter: {
    fontFamily: APP_FONTS.medium,
    fontSize: 11,
    color: APP_COLORS.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  manualNoteText: {
    fontFamily: APP_FONTS.regular,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 4,
    marginBottom: APP_SPACING.md,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: APP_SPACING.sm,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: APP_SPACING.sm,
  },
  toggleChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: APP_RADIUS.pill,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  toggleChipActive: {
    backgroundColor: APP_COLORS.primary,
    borderColor: APP_COLORS.primary,
  },
  toggleChipText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 11,
    color: APP_COLORS.textSecondary,
  },
  toggleChipTextActive: {
    color: APP_COLORS.white,
  },
  leaveList: {
    gap: APP_SPACING.sm,
  },
  leaveItemCard: {
    padding: APP_SPACING.lg,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  leaveItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: APP_SPACING.sm,
  },
  leaveItemTitleCol: {
    flex: 1,
  },
  leaveCourseName: {
    fontFamily: APP_FONTS.bold,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
  },
  leaveDateText: {
    fontFamily: APP_FONTS.regular,
    fontSize: 11,
    color: APP_COLORS.textMuted,
    marginTop: 2,
  },
  leaveReasonBox: {
    marginTop: APP_SPACING.sm,
    padding: APP_SPACING.md,
    backgroundColor: APP_COLORS.surfaceSubtle,
    borderRadius: APP_RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: APP_COLORS.primary,
  },
  leaveReasonText: {
    fontFamily: APP_FONTS.regular,
    fontSize: 13,
    color: APP_COLORS.inkPrimary,
    lineHeight: 19,
  },
  reviewerText: {
    marginTop: APP_SPACING.sm,
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
});

export default LeaveRequestScreen;
