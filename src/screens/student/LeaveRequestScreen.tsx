/**
 * Fritz — LeaveRequestScreen (Sprint 2)
 *
 * Layar Pengajuan Izin & Pemantauan Status Izin Real-time untuk Praktikan:
 * - Form pengajuan izin pada sesi praktikum tertentu dengan validasi alasan (Kebutuhan #9)
 * - Pencegahan pengajuan izin ganda pada sesi yang sama (Kebutuhan #10)
 * - Pemantauan status izin ('MENUNGGU', 'DITERIMA', 'DITOLAK') secara real-time via onSnapshot (Kebutuhan #10)
 */
import React, { useState } from 'react';
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
import { LeaveClassificationBadge } from '@/components/LeaveClassificationBadge';
import { EmptyState } from '@/components/EmptyState';
import { AppHeader } from '@/components/AppHeader';
import { BottomNavigation } from '@/components/BottomNavigation';
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

interface LeaveRequestScreenProps {
  navigation: NavigationProp;
}

export const LeaveRequestScreen: React.FC<LeaveRequestScreenProps> = ({
  navigation,
}) => {
  const { activeUser, activeScheduleId } = useApp();
  const {
    schedules,
    loading: schedulesLoading,
    error: schedulesError,
  } = useFirestoreSchedules(activeUser.id, 'student');
  const {
    leaveRequests,
    loading: leavesLoading,
  } = useStudentLeaveRequests(activeUser.id);

  const initialScheduleId =
    navigation.params?.scheduleId || activeScheduleId || schedules[0]?.id || '';
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(
    initialScheduleId,
  );
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const currentSchedule =
    schedules.find(s => s.id === selectedScheduleId) || schedules[0];

  const existingLeaveForSelected = currentSchedule
    ? leaveRequests.find(req => req.scheduleId === currentSchedule.id)
    : undefined;

  const isSessionFinished = currentSchedule?.status === 'SELESAI';

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
          : 'Gagal menyimpan pengajuan izin ke Cloud Firestore.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title="Pengajuan Izin"
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Pemilihan Sesi Praktikum */}
        <Text style={styles.sectionTitle}>Pilih Sesi Praktikum</Text>
        {schedulesLoading ? (
          <Card style={styles.card}>
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={APP_COLORS.primary} />
              <Text style={styles.loadingText}>Memuat jadwal praktikum...</Text>
            </View>
          </Card>
        ) : schedulesError ? (
          <Card style={styles.card}>
            <Text style={styles.loadingText}>{schedulesError}</Text>
          </Card>
        ) : schedules.length === 0 ? (
          <Card style={styles.card}>
            <Text style={styles.loadingText}>
              Belum ada jadwal praktikum yang terdaftar untuk akun Anda.
            </Text>
          </Card>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scheduleTabsRow}>
            {schedules.map(item => {
              const isSelected = item.id === currentSchedule?.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setSelectedScheduleId(item.id)}
                  style={[
                    styles.scheduleChip,
                    isSelected && styles.scheduleChipActive,
                  ]}>
                  <Text
                    style={[
                      styles.scheduleChipTitle,
                      isSelected && styles.scheduleChipTitleActive,
                    ]}>
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

        {/* Form Pengajuan Izin Sesi Terpilih */}
        {currentSchedule && (
          <Card style={styles.formCard}>
            <View style={styles.formHeaderRow}>
              <View style={styles.formTitleCol}>
                <Text style={styles.courseTitle}>{currentSchedule.courseName}</Text>
                <Text style={styles.courseMeta}>
                  {currentSchedule.className} • {currentSchedule.time} | {currentSchedule.room}
                </Text>
              </View>
              <StatusBadge status={currentSchedule.status} size="sm" />
            </View>

            {existingLeaveForSelected ? (
              <View style={styles.alreadySubmittedBox}>
                <View style={styles.alreadySubmittedHeader}>
                  <Ionicons
                    name="information-circle"
                    size={18}
                    color={APP_COLORS.primary}
                  />
                  <Text style={styles.alreadySubmittedTitle}>
                    Izin Sudah Diajukan untuk Sesi Ini
                  </Text>
                </View>
                <Text style={styles.alreadySubmittedDesc}>
                  Anda tidak dapat mengajukan izin lebih dari 1 kali pada sesi yang sama. Status saat ini:{' '}
                  <Text style={styles.boldText}>{existingLeaveForSelected.status}</Text>.
                </Text>
              </View>
            ) : isSessionFinished ? (
              <View style={styles.alreadySubmittedBox}>
                <Text style={styles.alreadySubmittedDesc}>
                  Sesi praktikum ini telah selesai (`SELESAI`). Pengajuan izin tidak dapat dilakukan lagi.
                </Text>
              </View>
            ) : (
              <View style={styles.formBody}>
                <Text style={styles.inputLabel}>Alasan Ketidakhadiran *</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Tuliskan alasan izin secara lengkap (mis. Sakit demam, urusan keluarga mendesak, delegasi lomba kampus)..."
                  placeholderTextColor={APP_COLORS.neutral400}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  value={reason}
                  onChangeText={setReason}
                  editable={!submitting}
                  textAlignVertical="top"
                />
                <Text style={styles.charCounter}>{reason.trim().length}/500 karakter</Text>

                <View style={styles.aiInfoBox}>
                  <Ionicons name="bulb-outline" size={16} color={APP_COLORS.primary} />
                  <Text style={styles.aiInfoText}>
                    Sistem AI akan mengklasifikasikan kategori alasan izin secara otomatis untuk membantu pemeriksaan asisten. Keputusan diterima/ditolak tetap 100% ditentukan oleh Asisten Praktikum.
                  </Text>
                </View>

                <CustomButton
                  title={submitting ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Izin'}
                  variant="primary"
                  size="lg"
                  loading={submitting}
                  disabled={submitting}
                  leftIcon={
                    !submitting ? (
                      <Ionicons
                        name="paper-plane-outline"
                        size={18}
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

        {/* Daftar Pemantauan Status Izin Real-time */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>Status Pengajuan Izin Saya (Real-time)</Text>
          {leavesLoading && (
            <ActivityIndicator size="small" color={APP_COLORS.primary} />
          )}
        </View>

        {leaveRequests.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              icon="document-text-outline"
              title="Belum Ada Pengajuan Izin"
              description="Riwayat dan status pengajuan izin ketidakhadiran Anda (MENUNGGU, DITERIMA, atau DITOLAK) akan tampil secara real-time di sini."
            />
          </Card>
        ) : (
          <View style={styles.leaveList}>
            {leaveRequests.map(item => {
              const matchedSchedule = schedules.find(s => s.id === item.scheduleId);
              const courseTitle =
                item.courseName || matchedSchedule?.courseName || 'Sesi Praktikum';
              const classSubtitle =
                item.className || matchedSchedule?.className || '';

              return (
                <Card key={item.id} style={styles.leaveItemCard}>
                  <View style={styles.leaveItemHeader}>
                    <View style={styles.leaveItemTitleCol}>
                      <Text style={styles.leaveCourseName}>
                        {courseTitle} {classSubtitle ? `• ${classSubtitle}` : ''}
                      </Text>
                      <Text style={styles.leaveDateText}>{item.createdAt}</Text>
                    </View>
                    <StatusBadge status={item.status} size="sm" />
                  </View>

                  <View style={styles.leaveReasonBox}>
                    <Text style={styles.leaveReasonLabel}>Alasan Izin:</Text>
                    <Text style={styles.leaveReasonText}>&quot;{item.reason}&quot;</Text>
                  </View>

                  <View style={styles.leaveBadgesRow}>
                    <LeaveClassificationBadge
                      classification={item.aiClassification}
                      aiStatus={item.aiStatus}
                      urgency={item.aiUrgency}
                      size="sm"
                    />
                  </View>

                  {item.reviewedBy ? (
                    <Text style={styles.reviewerText}>
                      Diperiksa oleh: {item.reviewedBy}{' '}
                      {item.reviewedAt ? `(${item.reviewedAt})` : ''}
                    </Text>
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      <BottomNavigation
        role="student"
        activeTab="StudentHome"
        onTabChange={tabKey => navigation.navigate(tabKey)}
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
    marginBottom: APP_SPACING.sm,
  },
  card: {
    padding: APP_SPACING.md,
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
    fontSize: 13,
    color: APP_COLORS.textSecondary,
  },
  scheduleTabsRow: {
    gap: APP_SPACING.sm,
    paddingBottom: APP_SPACING.md,
  },
  scheduleChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    minWidth: 160,
  },
  scheduleChipActive: {
    backgroundColor: APP_COLORS.primary,
    borderColor: APP_COLORS.primary,
  },
  scheduleChipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
  },
  scheduleChipTitleActive: {
    color: APP_COLORS.white,
  },
  scheduleChipSub: {
    fontSize: 11,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
  },
  scheduleChipSubActive: {
    color: '#DBEAFE',
  },
  formCard: {
    padding: APP_SPACING.md,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.lg,
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
    fontSize: 16,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
  },
  courseMeta: {
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
  },
  alreadySubmittedBox: {
    marginTop: APP_SPACING.md,
    padding: APP_SPACING.sm,
    backgroundColor: APP_COLORS.softBlue,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: APP_COLORS.lightBlue,
  },
  alreadySubmittedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  alreadySubmittedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: APP_COLORS.primary,
  },
  alreadySubmittedDesc: {
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
  },
  formBody: {
    marginTop: APP_SPACING.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: APP_COLORS.navyHeading,
    marginBottom: 6,
  },
  textArea: {
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: 10,
    padding: APP_SPACING.sm,
    minHeight: 96,
    fontSize: 13,
    color: APP_COLORS.navyHeading,
    backgroundColor: '#F8FAFC',
  },
  charCounter: {
    fontSize: 11,
    color: APP_COLORS.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  aiInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: APP_COLORS.softBlue,
    padding: APP_SPACING.sm,
    borderRadius: 8,
    marginTop: APP_SPACING.sm,
    marginBottom: APP_SPACING.md,
  },
  aiInfoText: {
    flex: 1,
    fontSize: 11,
    color: APP_COLORS.textSecondary,
    lineHeight: 16,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: APP_SPACING.sm,
  },
  emptyCard: {
    padding: APP_SPACING.sm,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  leaveList: {
    gap: APP_SPACING.sm,
  },
  leaveItemCard: {
    padding: APP_SPACING.md,
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
    fontSize: 14,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
  },
  leaveDateText: {
    fontSize: 11,
    color: APP_COLORS.textMuted,
    marginTop: 2,
  },
  leaveReasonBox: {
    marginTop: APP_SPACING.sm,
    padding: APP_SPACING.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  leaveReasonLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: APP_COLORS.textSecondary,
    marginBottom: 2,
  },
  leaveReasonText: {
    fontSize: 13,
    color: APP_COLORS.navyHeading,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  leaveBadgesRow: {
    marginTop: APP_SPACING.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reviewerText: {
    marginTop: APP_SPACING.xs,
    fontSize: 11,
    color: APP_COLORS.textSecondary,
  },
});

export default LeaveRequestScreen;
