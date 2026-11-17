/**
 * LeaveApprovalScreen (Sprint 2)
 *
 * Halaman Pemeriksaan & Keputusan Izin Manual oleh Asisten Praktikum:
 * - Menampilkan daftar pengajuan izin praktikan secara real-time (onSnapshot)
 * - Review dilakukan 100% secara manual oleh Asisten Praktikum (Terima / Tolak)
 * - Menyimpan keputusan ke Firestore secara real-time dan menyinkronkan status 'Izin'
 *   ke koleksi `attendances` jika disetujui.
 */
import React, { useMemo, useState } from 'react';
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
import type { LeaveRequestItem, LeaveRequestStatus } from '@/types/leaveRequest';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmModal } from '@/components/ConfirmModal';
import { EmptyState } from '@/components/EmptyState';
import { AppHeader } from '@/components/AppHeader';
import { BottomNavigation } from '@/components/BottomNavigation';
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
  APP_SPACING,
} from '@/constants/theme';

interface LeaveApprovalScreenProps {
  navigation: NavigationProp;
}

type FilterStatus = 'ALL' | LeaveRequestStatus;

export const LeaveApprovalScreen: React.FC<LeaveApprovalScreenProps> = ({
  navigation,
}) => {
  const { activeUser, activeScheduleId } = useApp();
  const {
    schedules,
    loading: schedulesLoading,
    error: schedulesError,
  } = useFirestoreSchedules(activeUser.id, 'assistant');

  const initialScheduleId =
    navigation.params?.scheduleId || activeScheduleId || schedules[0]?.id || '';
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(
    initialScheduleId,
  );
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');

  const currentSchedule =
    schedules.find((s) => s.id === selectedScheduleId) || schedules[0];

  const {
    leaveRequests,
    pendingCount,
    approvedCount,
    rejectedCount,
    loading: leavesLoading,
    error: leavesError,
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

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'ALL') return leaveRequests;
    return leaveRequests.filter((item) => item.status === statusFilter);
  }, [leaveRequests, statusFilter]);

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
        title="Review Izin Praktikan"
        subtitle="Keputusan manual oleh Asisten Praktikum"
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Pemilih Sesi Praktikum */}
        <Text style={styles.sectionTitle}>Pilih Sesi Praktikum</Text>
        {schedulesLoading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color={APP_COLORS.primary} />
            <Text style={styles.loadingText}>Memuat jadwal asisten...</Text>
          </View>
        ) : schedulesError ? (
          <View style={styles.stateCard}>
            <Text style={styles.loadingText}>{schedulesError}</Text>
          </View>
        ) : schedules.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.loadingText}>
              Belum ada jadwal praktikum yang ditugaskan untuk akun asisten ini.
            </Text>
          </View>
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

        {/* Bento Summary Cards untuk Status Izin (Reference UI image 4) */}
        <View style={styles.statsRow}>
          <Pressable
            onPress={() => setStatusFilter('MENUNGGU')}
            style={[styles.statBox, styles.statBoxPending]}>
            <Text style={styles.statValue}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Menunggu Review</Text>
          </Pressable>
          <Pressable
            onPress={() => setStatusFilter('DITERIMA')}
            style={[styles.statBox, styles.statBoxApproved]}>
            <Text style={styles.statValue}>{approvedCount}</Text>
            <Text style={styles.statLabel}>Diterima</Text>
          </Pressable>
          <Pressable
            onPress={() => setStatusFilter('DITOLAK')}
            style={[styles.statBox, styles.statBoxRejected]}>
            <Text style={styles.statValue}>{rejectedCount}</Text>
            <Text style={styles.statLabel}>Ditolak</Text>
          </Pressable>
        </View>

        {/* Filter Status Pills (Reference UI image 4) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsRow}>
          {[
            {
              key: 'ALL' as FilterStatus,
              label: 'Semua',
              count: leaveRequests.length,
              color: '#C7D2FE',
            },
            {
              key: 'MENUNGGU' as FilterStatus,
              label: 'Menunggu',
              count: pendingCount,
              color: '#FDE68A',
            },
            {
              key: 'DITERIMA' as FilterStatus,
              label: 'Diterima',
              count: approvedCount,
              color: '#86EFAC',
            },
            {
              key: 'DITOLAK' as FilterStatus,
              label: 'Ditolak',
              count: rejectedCount,
              color: '#FECACA',
            },
          ].map((pill) => {
            const active = statusFilter === pill.key;
            return (
              <Pressable
                key={pill.key}
                onPress={() => setStatusFilter(pill.key)}
                style={[styles.filterPill, active && styles.filterPillActive]}>
                <Text
                  style={[
                    styles.filterPillText,
                    active && styles.filterPillTextActive,
                  ]}>
                  {pill.label}
                </Text>
                <View
                  style={[
                    styles.filterCountBadge,
                    { backgroundColor: active ? pill.color : '#E2E8F0' },
                  ]}>
                  <Text style={styles.filterCountText}>{pill.count}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Daftar Pengajuan Izin */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>Daftar Pengajuan Izin</Text>
          {leavesLoading && (
            <ActivityIndicator size="small" color={APP_COLORS.primary} />
          )}
        </View>

        {leavesError ? (
          <View style={styles.stateCard}>
            <Text style={styles.loadingText}>{leavesError}</Text>
          </View>
        ) : filteredRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <EmptyState
              icon="document-text-outline"
              title="Belum Ada Pengajuan Izin"
              description="Pengajuan izin dari praktikan pada sesi ini akan muncul secara real-time di sini untuk direview secara manual oleh asisten."
            />
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filteredRequests.map((item) => {
              const isProcessing = processingId === item.id;
              const sessionTitle =
                item.courseName || currentSchedule?.courseName || 'Praktikum';
              const sessionClass =
                item.className || currentSchedule?.className || '';
              const studentInitial = (item.studentName || 'M')
                .charAt(0)
                .toUpperCase();

              return (
                <View key={item.id} style={styles.itemCard}>
                  {/* Baris Atas: Identitas Praktikan & Status */}
                  <View style={styles.itemHeaderRow}>
                    <View style={styles.studentAvatar}>
                      <Text style={styles.studentAvatarText}>
                        {studentInitial}
                      </Text>
                    </View>
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

                  {/* Alasan Ketidakhadiran */}
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>
                      Alasan Pengajuan Izin Praktikan:
                    </Text>
                    <Text style={styles.reasonText}>
                      &quot;{item.reason}&quot;
                    </Text>
                  </View>

                  {/* Info Reviewer jika sudah diproses */}
                  {item.reviewedBy ? (
                    <View style={styles.reviewedByPill}>
                      <Ionicons
                        name="checkmark-done-circle"
                        size={15}
                        color="#0F172A"
                      />
                      <Text style={styles.reviewedByText}>
                        Direview oleh Asisten: {item.reviewedBy}{' '}
                        {item.reviewedAt ? `• ${item.reviewedAt}` : ''}
                      </Text>
                    </View>
                  ) : null}

                  {/* Tombol Keputusan Manual Terima / Tolak (hanya saat MENUNGGU) */}
                  {item.status === 'MENUNGGU' ? (
                    <View style={styles.decisionRow}>
                      <Pressable
                        disabled={isProcessing}
                        onPress={() => handlePromptDecision(item, 'DITOLAK')}
                        style={({ pressed }) => [
                          styles.rejectPillBtn,
                          pressed && styles.pressed,
                        ]}>
                        <Ionicons
                          name="close-circle-outline"
                          size={17}
                          color="#DC2626"
                        />
                        <Text style={styles.rejectPillBtnText}>Tolak Izin</Text>
                      </Pressable>

                      <Pressable
                        disabled={isProcessing}
                        onPress={() => handlePromptDecision(item, 'DITERIMA')}
                        style={({ pressed }) => [
                          styles.approvePillBtn,
                          pressed && styles.pressed,
                        ]}>
                        {isProcessing ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons
                              name="checkmark-circle-outline"
                              size={17}
                              color="#FFFFFF"
                            />
                            <Text style={styles.approvePillBtnText}>
                              Terima Izin
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.lockedDecisionNotice}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={14}
                        color="#64748B"
                      />
                      <Text style={styles.lockedDecisionText}>
                        Keputusan final telah disimpan ({item.status}) dan
                        dikunci di Cloud Firestore.
                      </Text>
                    </View>
                  )}
                </View>
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
            ? `Status izin "${confirmDecision.item?.studentName}" akan disimpan sebagai DITERIMA dan otomatis tercatat sebagai "Izin" pada rekap presensi.`
            : `Status izin "${confirmDecision.item?.studentName}" akan disimpan sebagai DITOLAK di Cloud Firestore.`
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
          setConfirmDecision({
            visible: false,
            item: null,
            decision: 'DITERIMA',
          })
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
    backgroundColor: '#F5F6FA',
  },
  scrollContent: {
    paddingHorizontal: APP_SPACING.lg,
    paddingTop: APP_SPACING.sm,
    paddingBottom: APP_SPACING.xxl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  stateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0F172A',
    marginBottom: 14,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    flex: 1,
  },
  scheduleTabsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 16,
  },
  scheduleChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0F172A',
    minWidth: 165,
  },
  scheduleChipActive: {
    backgroundColor: '#0F172A',
  },
  scheduleChipTitle: {
    fontSize: 14,
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
    marginTop: 3,
  },
  scheduleChipSubActive: {
    color: '#CBD5E1',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  statBoxPending: {
    backgroundColor: '#FDE68A',
  },
  statBoxApproved: {
    backgroundColor: '#86EFAC',
  },
  statBoxRejected: {
    backgroundColor: '#FECACA',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
    textAlign: 'center',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 16,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  filterCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  emptyCard: {
    padding: 20,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  listContainer: {
    gap: 14,
  },
  itemCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#C7D2FE',
    borderWidth: 1.5,
    borderColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  studentAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  studentInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  studentMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  timestampText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  reasonBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 19,
    fontStyle: 'italic',
  },
  reviewedByPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  reviewedByText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '700',
  },
  decisionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  rejectPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#DC2626',
  },
  rejectPillBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  approvePillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  approvePillBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  lockedDecisionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  lockedDecisionText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.78,
  },
});

export default LeaveApprovalScreen;
