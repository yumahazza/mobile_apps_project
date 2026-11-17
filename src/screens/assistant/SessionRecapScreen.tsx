import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { useFirestoreSchedules } from '@/hooks/useFirestoreSchedules';
import { useRealtimeAttendance } from '@/hooks/useRealtimeAttendance';
import { useScheduleFeedbacks } from '@/hooks/useRealtimeFeedback';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { AppHeader } from '@/components/AppHeader';
import { BottomNavigation } from '@/components/BottomNavigation';
import { SentimentBadge } from '@/components/SentimentBadge';
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
  APP_FONTS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

interface SessionRecapScreenProps {
  navigation: NavigationProp;
}

export const SessionRecapScreen: React.FC<SessionRecapScreenProps> = ({
  navigation,
}) => {
  const { activeScheduleId, setActiveScheduleId, activeUser } = useApp();

  const {
    schedules,
    loading: schedulesLoading,
    error: schedulesError,
  } = useFirestoreSchedules(activeUser.id, 'assistant');

  const [searchQuery, setSearchQuery] = useState('');

  const requestedScheduleId = navigation.params?.scheduleId;
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(
    requestedScheduleId || activeScheduleId || '',
  );

  const currentSchedule =
    schedules.find((schedule) => schedule.id === selectedScheduleId) ||
    (requestedScheduleId
      ? schedules.find((schedule) => schedule.id === requestedScheduleId)
      : schedules.find((schedule) => schedule.id === activeScheduleId) ||
        schedules[0]);

  const scheduleNotFound =
    !schedulesLoading &&
    !schedulesError &&
    Boolean(requestedScheduleId) &&
    !currentSchedule;

  const {
    attendances,
    stats,
    loading: attendancesLoading,
    error: attendancesError,
  } = useRealtimeAttendance(
    currentSchedule?.id,
    currentSchedule?.totalStudents ?? 0,
  );

  const {
    feedbacks,
    loading: feedbacksLoading,
    error: feedbacksError,
  } = useScheduleFeedbacks(currentSchedule?.id);

  const filteredAttendanceLogs = useMemo(() => {
    if (!searchQuery.trim()) return attendances;

    const q = searchQuery.toLowerCase().trim();

    return attendances.filter(
      (log) =>
        log.studentName.toLowerCase().includes(q) ||
        (log.nim && log.nim.toLowerCase().includes(q)),
    );
  }, [attendances, searchQuery]);

  const sentimentCounts = useMemo(() => {
    const pos = feedbacks.filter((f) => f.sentiment === 'Positif').length;
    const net = feedbacks.filter((f) => f.sentiment === 'Netral').length;
    const neg = feedbacks.filter((f) => f.sentiment === 'Negatif').length;
    return { pos, net, neg };
  }, [feedbacks]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title="Rekap Presensi"
        subtitle={
          currentSchedule
            ? `${currentSchedule.courseName} · ${currentSchedule.className}`
            : 'Presensi & ulasan praktikum'
        }
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {schedulesLoading ? (
          <View style={styles.messageState}>
            <ActivityIndicator size="large" color={APP_COLORS.primary} />
            <Text style={styles.messageStateText}>Memuat data sesi...</Text>
          </View>
        ) : schedulesError ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Gagal Memuat Jadwal"
            description={schedulesError}
          />
        ) : scheduleNotFound ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Sesi Tidak Ditemukan"
            description="Sesi yang diminta tidak tersedia."
          />
        ) : !currentSchedule ? (
          <EmptyState
            icon="calendar-outline"
            title="Belum Ada Jadwal"
            description="Buat jadwal praktikum di menu Jadwal."
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

            {/* Hero Ringkasan Presensi (#273287 + #D8E63C) */}
            <View style={styles.reportCard}>
              <View style={styles.reportHeaderRow}>
                <View style={styles.reportTitleGroup}>
                  <Text style={styles.courseName} numberOfLines={2}>
                    {currentSchedule.courseName}
                  </Text>
                  <Text style={styles.sessionMeta}>
                    {currentSchedule.className} · {currentSchedule.time} · {currentSchedule.room}
                  </Text>
                </View>
                <StatusBadge status={currentSchedule.status} size="sm" />
              </View>

              <View style={styles.progressBlock}>
                <View style={styles.progressTopRow}>
                  <Text style={styles.progressLabel}>
                    {stats.hadirCount}/{stats.totalRegistered} Hadir
                  </Text>
                  <Text style={styles.progressValue}>
                    {stats.attendancePercentage}%
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(
                          100,
                          Math.max(0, stats.attendancePercentage),
                        )}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Ringkasan 1 Baris */}
              <View style={styles.metricsRow}>
                <View style={styles.metricCell}>
                  <Text style={styles.metricValue}>{stats.hadirCount}</Text>
                  <Text style={styles.metricLabel}>Hadir</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricCell}>
                  <Text style={styles.metricValue}>{stats.izinCount}</Text>
                  <Text style={styles.metricLabel}>Izin</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricCell}>
                  <Text style={styles.metricValue}>{stats.alfaCount}</Text>
                  <Text style={styles.metricLabel}>Alfa</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricCell}>
                  <Text style={styles.metricValue}>
                    {stats.totalRegistered}
                  </Text>
                  <Text style={styles.metricLabel}>Total</Text>
                </View>
              </View>

              <Pressable
                onPress={() =>
                  navigation.navigate('LeaveApproval', {
                    scheduleId: currentSchedule.id,
                  })
                }
                style={({ pressed }) => [
                  styles.leaveShortcutBtn,
                  pressed && styles.pressed,
                ]}>
                <View style={styles.leaveShortcutLeft}>
                  <Ionicons
                    name="clipboard-outline"
                    size={16}
                    color={APP_COLORS.tetsuKon}
                  />
                  <Text style={styles.leaveShortcutText}>Review Izin</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={APP_COLORS.tetsuKon}
                />
              </Pressable>
            </View>

            {/* Daftar Presensi Mahasiswa dalam Panel Putih Bersekat Tipis */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Daftar Hadir</Text>
                {attendancesLoading && (
                  <ActivityIndicator size="small" color={APP_COLORS.primary} />
                )}
              </View>

              <View style={styles.searchBox}>
                <Ionicons
                  name="search"
                  size={18}
                  color={APP_COLORS.textSecondary}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari nama atau NIM..."
                  placeholderTextColor={APP_COLORS.neutral400}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <Pressable
                    onPress={() => setSearchQuery('')}
                    hitSlop={8}
                    style={styles.clearSearchBtn}>
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={APP_COLORS.textSecondary}
                    />
                  </Pressable>
                )}
              </View>

              {attendancesError ? (
                <EmptyState
                  icon="alert-circle-outline"
                  title="Gagal Memuat Presensi"
                  description={attendancesError}
                />
              ) : attendancesLoading ? (
                <View style={styles.messageStateCompact}>
                  <ActivityIndicator size="small" color={APP_COLORS.primary} />
                  <Text style={styles.messageStateText}>Memuat presensi...</Text>
                </View>
              ) : filteredAttendanceLogs.length === 0 ? (
                <EmptyState
                  icon="people-outline"
                  title={
                    searchQuery.trim()
                      ? 'Tidak Ditemukan'
                      : 'Belum Ada Presensi'
                  }
                  description={
                    searchQuery.trim()
                      ? `Tidak ada hasil untuk "${searchQuery}".`
                      : 'Belum ada mahasiswa yang tercatat pada sesi ini.'
                  }
                />
              ) : (
                <View style={styles.attendancePanel}>
                  {filteredAttendanceLogs.map((log, index) => {
                    const initial = (log.studentName || 'M').charAt(0).toUpperCase();
                    const isLast = index === filteredAttendanceLogs.length - 1;

                    return (
                      <Pressable
                        key={log.id}
                        onPress={() =>
                          navigation.navigate('AttendanceDetail', {
                            record: log,
                            schedule: currentSchedule,
                          })
                        }
                        style={({ pressed }) => [
                          styles.attendanceRow,
                          !isLast && styles.attendanceRowDivider,
                          pressed && styles.pressed,
                        ]}>
                        <View style={styles.avatarInitialBox}>
                          <Text style={styles.avatarInitialText}>{initial}</Text>
                        </View>

                        <View style={styles.studentCol}>
                          <Text style={styles.studentNameText} numberOfLines={1}>
                            {log.studentName}
                          </Text>
                          <Text style={styles.studentNimText} numberOfLines={1}>
                            NIM {log.nim} · {log.timestamp}
                          </Text>
                        </View>

                        <StatusBadge status={log.status} size="sm" />
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Ulasan Praktikum + AI Sentiment */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Ulasan Praktikum</Text>
                <View style={styles.aiBadgePill}>
                  <Ionicons name="sparkles" size={11} color={APP_COLORS.primary} />
                  <Text style={styles.aiBadgePillText}>AI Sentimen</Text>
                </View>
              </View>

              {feedbacks.length > 0 && (
                <View style={styles.sentimentSummaryRow}>
                  <View style={[styles.sentimentChip, styles.sentimentPos]}>
                    <Text style={styles.sentimentPosText}>
                      {sentimentCounts.pos} Positif
                    </Text>
                  </View>
                  <View style={[styles.sentimentChip, styles.sentimentNet]}>
                    <Text style={styles.sentimentNetText}>
                      {sentimentCounts.net} Netral
                    </Text>
                  </View>
                  <View style={[styles.sentimentChip, styles.sentimentNeg]}>
                    <Text style={styles.sentimentNegText}>
                      {sentimentCounts.neg} Negatif
                    </Text>
                  </View>
                </View>
              )}

              {feedbacksError ? (
                <EmptyState
                  icon="alert-circle-outline"
                  title="Gagal Memuat Ulasan"
                  description={feedbacksError}
                />
              ) : feedbacksLoading ? (
                <View style={styles.messageStateCompact}>
                  <ActivityIndicator size="small" color={APP_COLORS.primary} />
                  <Text style={styles.messageStateText}>Memuat ulasan...</Text>
                </View>
              ) : feedbacks.length === 0 ? (
                <EmptyState
                  icon="chatbubbles-outline"
                  title="Belum Ada Ulasan"
                  description="Ulasan praktikan setelah sesi selesai akan tampil di sini."
                />
              ) : (
                <View style={styles.feedbackList}>
                  {feedbacks.map((fb) => (
                    <View key={fb.id} style={styles.feedbackCard}>
                      <View style={styles.feedbackCardHeader}>
                        <View style={styles.feedbackAuthorCol}>
                          <Text style={styles.feedbackAuthorName}>
                            {fb.studentName}
                          </Text>
                          <Text style={styles.feedbackDateText}>
                            {fb.createdAt || 'Baru saja'}
                          </Text>
                        </View>

                        <SentimentBadge sentiment={fb.sentiment} size="sm" />
                      </View>

                      <Text style={styles.feedbackCommentText}>
                        “{fb.comment}”
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <BottomNavigation
        role="assistant"
        activeTab="SessionRecap"
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
  messageState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: APP_SPACING.xl,
    minHeight: 160,
  },
  messageStateCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_SPACING.sm,
    paddingVertical: APP_SPACING.md,
  },
  messageStateText: {
    fontFamily: APP_FONTS.medium,
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
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
  reportCard: {
    backgroundColor: APP_COLORS.intergalactic,
    borderRadius: APP_RADIUS.hero,
    padding: APP_SPACING.xl,
    marginBottom: APP_SPACING.xl,
  },
  reportHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: APP_SPACING.md,
  },
  reportTitleGroup: {
    flex: 1,
  },
  courseName: {
    fontFamily: APP_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
    color: APP_COLORS.durantaYellow,
    marginBottom: 4,
  },
  sessionMeta: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.88)',
  },
  progressBlock: {
    marginBottom: APP_SPACING.md,
  },
  progressTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 13,
    color: APP_COLORS.white,
  },
  progressValue: {
    fontFamily: APP_FONTS.bold,
    fontSize: 14,
    color: APP_COLORS.durantaYellow,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: APP_COLORS.durantaYellow,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: APP_RADIUS.md,
    paddingVertical: 10,
    marginBottom: APP_SPACING.md,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  metricValue: {
    fontFamily: APP_FONTS.bold,
    fontSize: 17,
    color: APP_COLORS.white,
  },
  metricLabel: {
    fontFamily: APP_FONTS.medium,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 1,
  },
  leaveShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: APP_COLORS.durantaYellow,
    borderRadius: APP_RADIUS.md,
    minHeight: 46,
    paddingHorizontal: APP_SPACING.lg,
  },
  leaveShortcutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leaveShortcutText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 14,
    color: APP_COLORS.tetsuKon,
  },
  sectionBlock: {
    marginBottom: APP_SPACING.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: APP_SPACING.sm,
  },
  sectionTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 17,
    color: APP_COLORS.inkPrimary,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: APP_RADIUS.md,
    paddingHorizontal: APP_SPACING.md,
    height: 46,
    marginBottom: APP_SPACING.md,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: 8,
    fontFamily: APP_FONTS.regular,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
  },
  clearSearchBtn: {
    padding: 4,
  },
  attendancePanel: {
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    overflow: 'hidden',
  },
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: APP_SPACING.lg,
  },
  attendanceRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.divider,
  },
  avatarInitialBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: APP_COLORS.nordicBreeze,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitialText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
  },
  studentCol: {
    flex: 1,
    marginRight: 8,
  },
  studentNameText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
  },
  studentNimText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 1,
  },
  pressed: {
    opacity: 0.78,
  },
  aiBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: APP_COLORS.softBlue,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: APP_RADIUS.pill,
  },
  aiBadgePillText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 11,
    color: APP_COLORS.primary,
  },
  sentimentSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: APP_SPACING.md,
  },
  sentimentChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: APP_RADIUS.md,
  },
  sentimentPos: {
    backgroundColor: APP_COLORS.openedSoft,
  },
  sentimentNet: {
    backgroundColor: APP_COLORS.softBlue,
  },
  sentimentNeg: {
    backgroundColor: APP_COLORS.dangerSoft,
  },
  sentimentPosText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 12,
    color: APP_COLORS.opened,
  },
  sentimentNetText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 12,
    color: APP_COLORS.primary,
  },
  sentimentNegText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 12,
    color: APP_COLORS.dangerText,
  },
  feedbackList: {
    gap: APP_SPACING.sm,
  },
  feedbackCard: {
    padding: APP_SPACING.lg,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  feedbackCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  feedbackAuthorCol: {
    flex: 1,
    marginRight: 8,
  },
  feedbackAuthorName: {
    fontFamily: APP_FONTS.bold,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
  },
  feedbackDateText: {
    fontFamily: APP_FONTS.regular,
    fontSize: 11,
    color: APP_COLORS.textMuted,
    marginTop: 1,
  },
  feedbackCommentText: {
    fontFamily: APP_FONTS.regular,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
    lineHeight: 20,
    marginTop: 4,
  },
});

export default SessionRecapScreen;
