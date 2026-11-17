/**
 * LeaveApprovalScreen
 * Pemeriksaan & keputusan izin manual oleh Asisten Praktikum.
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
  APP_FONTS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

interface LeaveApprovalScreenProps {
  navigation: NavigationProp;
}

type FilterStatus = 'ALL' | LeaveRequestStatus;

export const LeaveApprovalScreen: React.FC<LeaveApprovalScreenProps> = ({
  navigation,
}) => {
  const { activeUser, activeScheduleId, setActiveScheduleId } = useApp();
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
    schedules.find((s) => s.id === selectedScheduleId) ||
    (navigation.params?.scheduleId
      ? schedules.find((s) => s.id === navigation.params?.scheduleId)
      : schedules.find((s) => s.id === activeScheduleId)) ||
    schedules[0];

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
        'Gagal Memproses',
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan keputusan izin.',
      );
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title="Review Izin"
        subtitle="Persetujuan manual oleh asisten"
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Pilih Sesi</Text>
        {schedulesLoading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color={APP_COLORS.primary} />
            <Text style={styles.loadingText}>Memuat jadwal...</Text>
          </View>
        ) : schedulesError ? (
          <View style={styles.stateCard}>
            <Text style={styles.loadingText}>{schedulesError}</Text>
          </View>
        ) : schedules.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.loadingText}>Belum ada jadwal tersedia.</Text>
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
                  onPress={() => {
                    setSelectedScheduleId(item.id);
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

        {/* Strip Ringkasan 1 Baris */}
        <View style={styles.summaryStrip}>
          <Pressable
            onPress={() => setStatusFilter('MENUNGGU')}
            style={({ pressed }) => [
              styles.summaryCell,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.statValue, { color: APP_COLORS.warning }]}>
              {pendingCount}
            </Text>
            <Text style={styles.statLabel}>Menunggu</Text>
          </Pressable>
          <View style={styles.summaryDivider} />
          <Pressable
            onPress={() => setStatusFilter('DITERIMA')}
            style={({ pressed }) => [
              styles.summaryCell,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.statValue, { color: APP_COLORS.opened }]}>
              {approvedCount}
            </Text>
            <Text style={styles.statLabel}>Diterima</Text>
          </Pressable>
          <View style={styles.summaryDivider} />
          <Pressable
            onPress={() => setStatusFilter('DITOLAK')}
            style={({ pressed }) => [
              styles.summaryCell,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.statValue, { color: APP_COLORS.dangerText }]}>
              {rejectedCount}
            </Text>
            <Text style={styles.statLabel}>Ditolak</Text>
          </Pressable>
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsRow}>
          {[
            { key: 'ALL' as FilterStatus, label: `Semua (${leaveRequests.length})` },
            { key: 'MENUNGGU' as FilterStatus, label: `Menunggu (${pendingCount})` },
            { key: 'DITERIMA' as FilterStatus, label: `Diterima (${approvedCount})` },
            { key: 'DITOLAK' as FilterStatus, label: `Ditolak (${rejectedCount})` },
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
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>Daftar Pengajuan</Text>
          {leavesLoading && (
            <ActivityIndicator size="small" color={APP_COLORS.primary} />
          )}
        </View>

        {leavesError ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Gagal Memuat Izin"
            description={leavesError}
          />
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title="Belum Ada Pengajuan"
            description="Pengajuan izin praktikan pada sesi ini akan tampil di sini."
          />
        ) : (
          <View style={styles.listContainer}>
            {filteredRequests.map((item) => {
              const isProcessing = processingId === item.id;
              const sessionTitle =
                currentSchedule?.courseName || item.courseName || 'Praktikum';
              const sessionClass =
                currentSchedule?.className || item.className || '';
              const studentInitial = (item.studentName || 'M')
                .charAt(0)
                .toUpperCase();

              return (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemHeaderRow}>
                    <View style={styles.studentAvatar}>
                      <Text style={styles.studentAvatarText}>
                        {studentInitial}
                      </Text>
                    </View>
                    <View style={styles.studentInfoCol}>
                      <Text style={styles.studentName}>{item.studentName}</Text>
                      <Text style={styles.studentMeta} numberOfLines={1}>
                        NIM {item.nim} · {sessionTitle}
                        {sessionClass ? ` (${sessionClass})` : ''}
                      </Text>
                      <Text style={styles.timestampText}>{item.createdAt}</Text>
                    </View>
                    <StatusBadge status={item.status} size="sm" />
                  </View>

                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>Alasan Izin</Text>
                    <Text style={styles.reasonText}>“{item.reason}”</Text>
                  </View>

                  {item.reviewedBy ? (
                    <Text style={styles.reviewedByText}>
                      Direview: {item.reviewedBy}
                      {item.reviewedAt ? ` · ${item.reviewedAt}` : ''}
                    </Text>
                  ) : null}

                  {item.status === 'MENUNGGU' ? (
                    <View style={styles.decisionRow}>
                      <Pressable
                        disabled={isProcessing}
                        onPress={() => handlePromptDecision(item, 'DITOLAK')}
                        style={({ pressed }) => [
                          styles.rejectBtn,
                          pressed && styles.pressed,
                        ]}>
                        <Ionicons
                          name="close-circle-outline"
                          size={16}
                          color={APP_COLORS.dangerText}
                        />
                        <Text style={styles.rejectBtnText}>Tolak</Text>
                      </Pressable>

                      <Pressable
                        disabled={isProcessing}
                        onPress={() => handlePromptDecision(item, 'DITERIMA')}
                        style={({ pressed }) => [
                          styles.approveBtn,
                          pressed && styles.pressed,
                        ]}>
                        {isProcessing ? (
                          <ActivityIndicator size="small" color={APP_COLORS.white} />
                        ) : (
                          <>
                            <Ionicons
                              name="checkmark-circle-outline"
                              size={16}
                              color={APP_COLORS.white}
                            />
                            <Text style={styles.approveBtnText}>Terima</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <ConfirmModal
        visible={confirmDecision.visible}
        title={
          confirmDecision.decision === 'DITERIMA'
            ? 'Terima Pengajuan Izin?'
            : 'Tolak Pengajuan Izin?'
        }
        subtitle={
          confirmDecision.decision === 'DITERIMA'
            ? `Status izin ${confirmDecision.item?.studentName} akan disimpan sebagai DITERIMA.`
            : `Status izin ${confirmDecision.item?.studentName} akan disimpan sebagai DITOLAK.`
        }
        details={{
          courseName:
            currentSchedule?.courseName || confirmDecision.item?.courseName,
          className:
            currentSchedule?.className || confirmDecision.item?.className,
          time: currentSchedule?.time,
          room: currentSchedule?.room,
        }}
        confirmText={
          confirmDecision.decision === 'DITERIMA' ? 'Ya, Terima' : 'Ya, Tolak'
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
  stateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: APP_SPACING.lg,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.md,
  },
  loadingText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
    flex: 1,
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
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    paddingVertical: APP_SPACING.md,
    marginBottom: APP_SPACING.md,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: APP_COLORS.divider,
  },
  statValue: {
    fontFamily: APP_FONTS.bold,
    fontSize: 18,
  },
  statLabel: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
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
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  listContainer: {
    gap: APP_SPACING.md,
  },
  itemCard: {
    padding: APP_SPACING.lg,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: APP_SPACING.md,
  },
  studentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: APP_COLORS.nordicBreeze,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  studentAvatarText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
  },
  studentInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  studentName: {
    fontFamily: APP_FONTS.bold,
    fontSize: 15,
    color: APP_COLORS.inkPrimary,
  },
  studentMeta: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 1,
  },
  timestampText: {
    fontFamily: APP_FONTS.regular,
    fontSize: 11,
    color: APP_COLORS.textMuted,
    marginTop: 2,
  },
  reasonBox: {
    backgroundColor: APP_COLORS.surfaceSubtle,
    borderRadius: APP_RADIUS.md,
    padding: APP_SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: APP_COLORS.primary,
    marginBottom: APP_SPACING.sm,
  },
  reasonLabel: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 11,
    color: APP_COLORS.textSecondary,
    marginBottom: 3,
  },
  reasonText: {
    fontFamily: APP_FONTS.regular,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
    lineHeight: 20,
  },
  reviewedByText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
  },
  decisionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: APP_SPACING.sm,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: APP_RADIUS.md,
    backgroundColor: APP_COLORS.dangerSoft,
  },
  rejectBtnText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 13,
    color: APP_COLORS.dangerText,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: APP_RADIUS.md,
    backgroundColor: APP_COLORS.primary,
  },
  approveBtnText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 13,
    color: APP_COLORS.white,
  },
  pressed: {
    opacity: 0.78,
  },
});

export default LeaveApprovalScreen;
