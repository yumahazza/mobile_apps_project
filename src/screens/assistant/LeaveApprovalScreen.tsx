/**
 * Fritz — LeaveApprovalScreen (Sprint 2)
 *
 * Halaman Pemeriksaan & Keputusan Izin untuk Asisten Praktikum (Kebutuhan #11):
 * - Menampilkan daftar pengajuan izin praktikan secara real-time (onSnapshot)
 * - Menampilkan nama praktikan, NIM, sesi, alasan izin, serta badge hasil klasifikasi AI
 * - Menyediakan tombol Terima ('DITERIMA') dan Tolak ('DITOLAK')
 * - Menyimpan keputusan ke Firestore secara real-time dan menyinkronkan status 'Izin'
 *   ke koleksi `attendances` jika disetujui.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
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
import { useScheduleLeaveRequests } from '@/hooks/useRealtimeLeaveRequests';
import { reviewLeaveRequest } from '@/services/leaveRequestService';
import type { LeaveRequestItem } from '@/types/leaveRequest';
import { Card } from '@/components/Card';
import { CustomButton } from '@/components/CustomButton';
import { StatusBadge } from '@/components/StatusBadge';
import { LeaveClassificationBadge } from '@/components/LeaveClassificationBadge';
import { ConfirmModal } from '@/components/ConfirmModal';
import { EmptyState } from '@/components/EmptyState';
import { AppHeader } from '@/components/AppHeader';
import { BottomNavigation } from '@/components/BottomNavigation';
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

interface LeaveApprovalScreenProps {
  navigation: NavigationProp;
}

export const LeaveApprovalScreen: React.FC<LeaveApprovalScreenProps> = ({
  navigation,
}) => {
  const { activeUser, activeScheduleId, schedules: contextSchedules } = useApp();
  const { schedules: firestoreSchedules, loading: schedulesLoading } = useFirestoreSchedules(
    activeUser.id,
    'assistant',
  );
  const schedules =
    firestoreSchedules.length > 0 ? firestoreSchedules : contextSchedules;

  const initialScheduleId =
    navigation.params?.scheduleId || activeScheduleId || schedules[0]?.id || '';
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(
    initialScheduleId,
  );

  const currentSchedule =
    schedules.find(s => s.id === selectedScheduleId) || schedules[0];

  const {
    leaveRequests,
    pendingCount,
    approvedCount,
    rejectedCount,
    loading: leavesLoading,
  } = useScheduleLeaveRequests(currentSchedule?.id);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmDecision, setConfirmDecision] = useState<{
    visible: boolean;
    item: LeaveRequestItem | null;
    decision: 'DITERIMA' | 'DITOLAK';
  }>({
    visible: false,
    item: null,
    decision: 'DITERIMA',
  });

  const handlePromptDecision = (
    item: LeaveRequestItem,
    decision: 'DITERIMA' | 'DITOLAK',
  ) => {
    setConfirmDecision({
      visible: true,
      item,
      decision,
    });
  };

  const handleConfirmDecision = async () => {
    const targetItem = confirmDecision.item;
    const decision = confirmDecision.decision;
    setConfirmDecision({ visible: false, item: null, decision: 'DITERIMA' });

    if (!targetItem) return;

    try {
      setProcessingId(targetItem.id);
      const res = await reviewLeaveRequest({
        scheduleId: targetItem.scheduleId,
        studentId: targetItem.studentId,
        decision,
        assistantId: activeUser.id,
        assistantName: activeUser.name,
      });
      Alert.alert(
        decision === 'DITERIMA' ? 'Izin Diterima' : 'Izin Ditolak',
        res.message,
      );
    } catch (err) {
      Alert.alert(
        'Gagal Memproses Keputusan',
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan keputusan izin ke Cloud Firestore.',
      );
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title="Pemeriksaan Izin"
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Pemilih Sesi Praktikum */}
        <Text style={styles.sectionTitle}>Pilih Sesi Praktikum</Text>
        {schedulesLoading ? (
          <Card style={styles.card}>
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={APP_COLORS.primary} />
              <Text style={styles.loadingText}>Memuat jadwal asisten...</Text>
            </View>
          </Card>
        ) : schedules.length === 0 ? (
          <Card style={styles.card}>
            <Text style={styles.loadingText}>
              Belum ada jadwal praktikum yang ditugaskan untuk akun asisten ini.
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

        {/* Ringkasan Statistik Pengajuan Izin Sesi */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, styles.statBoxPending]}>
            <Text style={styles.statValue}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Menunggu</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxApproved]}>
            <Text style={styles.statValue}>{approvedCount}</Text>
            <Text style={styles.statLabel}>Diterima</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxRejected]}>
            <Text style={styles.statValue}>{rejectedCount}</Text>
            <Text style={styles.statLabel}>Ditolak</Text>
          </View>
        </View>

        {/* Daftar Pengajuan Izin */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>Daftar Pengajuan Izin Mahasiswa</Text>
          {leavesLoading && (
            <ActivityIndicator size="small" color={APP_COLORS.primary} />
          )}
        </View>

        {leaveRequests.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              icon="document-text-outline"
              title="Belum Ada Pengajuan Izin"
              description="Pengajuan izin dari praktikan pada sesi ini beserta klasifikasi AI akan muncul secara real-time di sini."
            />
          </Card>
        ) : (
          <View style={styles.listContainer}>
            {leaveRequests.map(item => {
              const isProcessing = processingId === item.id;
              const sessionTitle =
                item.courseName || currentSchedule?.courseName || 'Praktikum';
              const sessionClass =
                item.className || currentSchedule?.className || '';

              return (
                <Card key={item.id} style={styles.itemCard}>
                  {/* Baris Atas: Identitas Praktikan & Status */}
                  <View style={styles.itemHeaderRow}>
                    <View style={styles.studentInfoCol}>
                      <Text style={styles.studentName}>{item.studentName}</Text>
                      <Text style={styles.studentMeta}>
                        NIM {item.nim} • {sessionTitle}{' '}
                        {sessionClass ? `(${sessionClass})` : ''}
                      </Text>
                      <Text style={styles.timestampText}>
                        Diajukan: {item.createdAt}
                      </Text>
                    </View>
                    <StatusBadge status={item.status} size="sm" />
                  </View>

                  {/* Klasifikasi AI Badge & Ringkasan */}
                  <View style={styles.aiSection}>
                    <LeaveClassificationBadge
                      classification={item.aiClassification}
                      aiStatus={item.aiStatus}
                      urgency={item.aiUrgency}
                      size="md"
                    />
                    <Text style={styles.aiSummaryText}>{item.aiSummary}</Text>
                  </View>

                  {/* Alasan Ketidakhadiran */}
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>Alasan Praktikan:</Text>
                    <Text style={styles.reasonText}>&quot;{item.reason}&quot;</Text>
                  </View>

                  {/* Info Reviewer jika sudah diproses */}
                  {item.reviewedBy ? (
                    <Text style={styles.reviewedByText}>
                      Diputuskan oleh: {item.reviewedBy}{' '}
                      {item.reviewedAt ? `• ${item.reviewedAt}` : ''}
                    </Text>
                  ) : null}

                  {/* Tombol Keputusan Terima / Tolak */}
                  <View style={styles.decisionRow}>
                    <View style={styles.decisionBtnCol}>
                      <CustomButton
                        title="Tolak"
                        variant={item.status === 'DITOLAK' ? 'danger' : 'outline'}
                        size="md"
                        disabled={isProcessing || item.status === 'DITOLAK'}
                        leftIcon={
                          <Ionicons
                            name="close-circle-outline"
                            size={16}
                            color={
                              item.status === 'DITOLAK'
                                ? APP_COLORS.white
                                : APP_COLORS.danger
                            }
                          />
                        }
                        onPress={() => handlePromptDecision(item, 'DITOLAK')}
                      />
                    </View>
                    <View style={styles.decisionBtnCol}>
                      <CustomButton
                        title="Terima"
                        variant="primary"
                        size="md"
                        loading={isProcessing}
                        disabled={isProcessing || item.status === 'DITERIMA'}
                        leftIcon={
                          !isProcessing ? (
                            <Ionicons
                              name="checkmark-circle-outline"
                              size={16}
                              color={APP_COLORS.white}
                            />
                          ) : undefined
                        }
                        onPress={() => handlePromptDecision(item, 'DITERIMA')}
                      />
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal Konfirmasi Keputusan Asisten */}
      <ConfirmModal
        visible={confirmDecision.visible}
        title={
          confirmDecision.decision === 'DITERIMA'
            ? 'Terima Pengajuan Izin?'
            : 'Tolak Pengajuan Izin?'
        }
        subtitle={
          confirmDecision.decision === 'DITERIMA'
            ? `Pengajuan izin dari ${confirmDecision.item?.studentName || 'praktikan'} akan disetujui (DITERIMA) dan status kehadiran otomatis tercatat sebagai Izin pada rekap presensi.`
            : `Pengajuan izin dari ${confirmDecision.item?.studentName || 'praktikan'} akan ditolak (DITOLAK).`
        }
        details={{
          courseName:
            confirmDecision.item?.courseName || currentSchedule?.courseName,
          className:
            confirmDecision.item?.className || currentSchedule?.className,
          time: currentSchedule?.time,
          room: currentSchedule?.room,
        }}
        confirmText={
          confirmDecision.decision === 'DITERIMA'
            ? 'Ya, Terima Izin'
            : 'Ya, Tolak Izin'
        }
        cancelText="Batal"
        confirmVariant={
          confirmDecision.decision === 'DITERIMA' ? 'primary' : 'danger'
        }
        onConfirm={handleConfirmDecision}
        onCancel={() =>
          setConfirmDecision({ visible: false, item: null, decision: 'DITERIMA' })
        }
      />

      <BottomNavigation
        role="assistant"
        activeTab="AssistantHome"
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
  statsRow: {
    flexDirection: 'row',
    gap: APP_SPACING.sm,
    marginBottom: APP_SPACING.lg,
  },
  statBox: {
    flex: 1,
    paddingVertical: APP_SPACING.sm,
    paddingHorizontal: APP_SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statBoxPending: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  statBoxApproved: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  statBoxRejected: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: APP_COLORS.textSecondary,
    marginTop: 2,
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
  listContainer: {
    gap: APP_SPACING.md,
  },
  itemCard: {
    padding: APP_SPACING.md,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: APP_SPACING.sm,
  },
  studentInfoCol: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
  },
  studentMeta: {
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
  },
  timestampText: {
    fontSize: 11,
    color: APP_COLORS.textMuted,
    marginTop: 2,
  },
  aiSection: {
    marginTop: APP_SPACING.sm,
    padding: APP_SPACING.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    gap: 4,
  },
  aiSummaryText: {
    fontSize: 11,
    color: APP_COLORS.textSecondary,
    lineHeight: 16,
  },
  reasonBox: {
    marginTop: APP_SPACING.sm,
    padding: APP_SPACING.sm,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 13,
    color: APP_COLORS.navyHeading,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  reviewedByText: {
    marginTop: APP_SPACING.xs,
    fontSize: 11,
    color: APP_COLORS.textSecondary,
  },
  decisionRow: {
    marginTop: APP_SPACING.md,
    flexDirection: 'row',
    gap: APP_SPACING.sm,
  },
  decisionBtnCol: {
    flex: 1,
  },
});

export default LeaveApprovalScreen;
