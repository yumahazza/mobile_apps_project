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

  // Presensi real-time dari Cloud Firestore
  const {
    attendances,
    stats,
    loading: attendancesLoading,
    error: attendancesError,
  } = useRealtimeAttendance(
    currentSchedule?.id,
    currentSchedule?.totalStudents ?? 0,
  );

  // Feedback dan sentimen AI praktikan dari Cloud Firestore
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
        title="Rekap & Ulasan AI"
        subtitle="Presensi real-time & sentimen pesan/kesan"
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
          <View style={styles.messageState}>
            <Ionicons
              name="alert-circle-outline"
              size={28}
              color={APP_COLORS.error}
            />
            <Text style={styles.messageStateText}>
              Gagal memuat jadwal: {schedulesError}
            </Text>
          </View>
        ) : scheduleNotFound ? (
          <View style={styles.messageState}>
            <Ionicons
              name="alert-circle-outline"
              size={28}
              color={APP_COLORS.neutral500}
            />
            <Text style={styles.messageStateText}>
              Sesi yang diminta tidak ditemukan atau tidak dapat diakses.
            </Text>
          </View>
        ) : !currentSchedule ? (
          <View style={styles.messageState}>
            <Ionicons
              name="calendar-outline"
              size={28}
              color={APP_COLORS.neutral500}
            />
            <Text style={styles.messageStateText}>
              Belum ada jadwal praktikum yang tersedia.
            </Text>
          </View>
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
                        {item.className} • {item.date}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* Data Report Hero Card (Reference UI image 5 & image 6) */}
            <View style={styles.reportCard}>
              <View style={styles.reportHeaderRow}>
                <View style={styles.reportTitleGroup}>
                  <Text style={styles.courseName}>
                    {currentSchedule.courseName}
                  </Text>
                  <Text style={styles.sessionMeta}>
                    {currentSchedule.className} • {currentSchedule.time} |{' '}
                    {currentSchedule.room}
                  </Text>
                </View>
                <StatusBadge status={currentSchedule.status} size="sm" />
              </View>

              <View style={styles.progressBlock}>
                <View style={styles.progressTopRow}>
                  <Text style={styles.progressLabel}>Tingkat Kehadiran</Text>
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

              {/* 4 Bento Mini Stat Tiles */}
              <View style={styles.metricsRow}>
                <View style={[styles.metricBox, styles.metricGreen]}>
                  <Text style={styles.metricValue}>{stats.hadirCount}</Text>
                  <Text style={styles.metricLabel}>Hadir</Text>
                </View>
                <View style={[styles.metricBox, styles.metricAmber]}>
                  <Text style={styles.metricValue}>{stats.izinCount}</Text>
                  <Text style={styles.metricLabel}>Izin</Text>
                </View>
                <View style={[styles.metricBox, styles.metricRed]}>
                  <Text style={styles.metricValue}>{stats.alfaCount}</Text>
                  <Text style={styles.metricLabel}>Alfa</Text>
                </View>
                <View style={[styles.metricBox, styles.metricBlue]}>
                  <Text style={styles.metricValue}>
                    {stats.totalRegistered}
                  </Text>
                  <Text style={styles.metricLabel}>Total</Text>
                </View>
              </View>

              {/* Tombol Review Pengajuan Izin Manual */}
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
                    size={17}
                    color="#FFFFFF"
                  />
                  <Text style={styles.leaveShortcutText}>
                    Review Pengajuan Izin Praktikan
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Daftar presensi mahasiswa */}
            <View style={styles.studentListSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>
                  Daftar Presensi Mahasiswa
                </Text>
                {attendancesLoading && (
                  <ActivityIndicator size="small" color={APP_COLORS.primary} />
                )}
              </View>

              <View style={styles.searchBox}>
                <Ionicons
                  name="search"
                  size={18}
                  color={APP_COLORS.neutral500}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari nama atau NIM praktikan..."
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
                      color={APP_COLORS.neutral500}
                    />
                  </Pressable>
                )}
              </View>

              {attendancesError ? (
                <View style={styles.messageState}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={24}
                    color={APP_COLORS.error}
                  />
                  <Text style={styles.messageStateText}>
                    Gagal memuat presensi: {attendancesError}
                  </Text>
                </View>
              ) : attendancesLoading ? (
                <View style={styles.messageState}>
                  <ActivityIndicator size="small" color={APP_COLORS.primary} />
                  <Text style={styles.messageStateText}>
                    Memuat data presensi...
                  </Text>
                </View>
              ) : filteredAttendanceLogs.length === 0 ? (
                <EmptyState
                  icon="people-outline"
                  title={
                    searchQuery.trim()
                      ? 'Mahasiswa Tidak Ditemukan'
                      : 'Belum Ada Mahasiswa Tercatat'
                  }
                  description={
                    searchQuery.trim()
                      ? `Tidak ada data presensi yang cocok dengan kata kunci "${searchQuery}".`
                      : 'Belum ada catatan presensi atau izin yang disetujui untuk sesi ini.'
                  }
                />
              ) : (
                <View style={styles.attendanceCardsList}>
                  {filteredAttendanceLogs.map((log, index) => (
                    <Pressable
                      key={log.id}
                      onPress={() =>
                        navigation.navigate('AttendanceDetail', {
                          record: log,
                          schedule: currentSchedule,
                        })
                      }
                      style={({ pressed }) => [
                        styles.attendanceItemCard,
                        pressed && styles.pressed,
                      ]}>
                      <View style={styles.indexCircle}>
                        <Text style={styles.indexCircleText}>{index + 1}</Text>
                      </View>

                      <View style={styles.studentCol}>
                        <Text style={styles.studentNameText} numberOfLines={1}>
                          {log.studentName}
                        </Text>
                        <Text style={styles.studentNimText}>
                          NIM {log.nim} • {log.timestamp}
                        </Text>
                      </View>

                      <StatusBadge status={log.status} size="sm" />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Pesan & Kesan Mahasiswa + AI Sentiment Review */}
            <View style={styles.feedbackSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.aiHeaderLeft}>
                  <Text style={styles.sectionTitle}>
                    Ulasan Praktikum (Review AI)
                  </Text>
                  <View style={styles.aiBadgePill}>
                    <Ionicons name="sparkles" size={11} color="#4F46E5" />
                    <Text style={styles.aiBadgePillText}>AI Sentimen</Text>
                  </View>
                </View>

                {feedbacksLoading && (
                  <ActivityIndicator size="small" color={APP_COLORS.primary} />
                )}
              </View>

              {/* Ringkasan Sentimen AI */}
              {feedbacks.length > 0 && (
                <View style={styles.sentimentSummaryRow}>
                  <View style={[styles.sentimentChip, styles.sentimentPos]}>
                    <Text style={styles.sentimentChipNum}>
                      {sentimentCounts.pos}
                    </Text>
                    <Text style={styles.sentimentChipText}>Positif</Text>
                  </View>
                  <View style={[styles.sentimentChip, styles.sentimentNet]}>
                    <Text style={styles.sentimentChipNum}>
                      {sentimentCounts.net}
                    </Text>
                    <Text style={styles.sentimentChipText}>Netral</Text>
                  </View>
                  <View style={[styles.sentimentChip, styles.sentimentNeg]}>
                    <Text style={styles.sentimentChipNum}>
                      {sentimentCounts.neg}
                    </Text>
                    <Text style={styles.sentimentChipText}>Negatif</Text>
                  </View>
                </View>
              )}

              {feedbacksError ? (
                <View style={styles.messageState}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={24}
                    color={APP_COLORS.error}
                  />
                  <Text style={styles.messageStateText}>
                    Gagal memuat pesan dan kesan: {feedbacksError}
                  </Text>
                </View>
              ) : feedbacksLoading ? (
                <View style={styles.messageState}>
                  <ActivityIndicator size="small" color={APP_COLORS.primary} />
                  <Text style={styles.messageStateText}>
                    Memuat pesan dan kesan...
                  </Text>
                </View>
              ) : feedbacks.length === 0 ? (
                <View style={styles.feedbackEmptyCard}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={26}
                    color="#64748B"
                  />
                  <Text style={styles.feedbackEmptyTitle}>
                    Belum Ada Ulasan Praktikum
                  </Text>
                  <Text style={styles.feedbackEmptyDesc}>
                    Ulasan praktikan setelah sesi selesai akan dianalisis
                    otomatis oleh AI (Positif, Netral, Negatif) dan tampil di
                    sini.
                  </Text>
                </View>
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
                        &quot;{fb.comment}&quot;
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
    backgroundColor: '#F5F6FA',
  },
  scrollContent: {
    paddingHorizontal: APP_SPACING.lg,
    paddingTop: APP_SPACING.sm,
    paddingBottom: APP_SPACING.xxl,
  },
  messageState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: APP_SPACING.xl,
    minHeight: 160,
  },
  messageStateText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: APP_SPACING.sm,
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
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#0F172A',
    marginBottom: 18,
  },
  reportHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  reportTitleGroup: {
    flex: 1,
  },
  courseName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 3,
  },
  sessionMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  progressBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  progressTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  progressValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#0F172A',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metricBox: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  metricGreen: {
    backgroundColor: '#86EFAC',
  },
  metricAmber: {
    backgroundColor: '#FDE68A',
  },
  metricRed: {
    backgroundColor: '#FECACA',
  },
  metricBlue: {
    backgroundColor: '#C7D2FE',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  leaveShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  leaveShortcutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leaveShortcutText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  studentListSection: {
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0F172A',
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  clearSearchBtn: {
    padding: 4,
  },
  attendanceCardsList: {
    gap: 10,
  },
  attendanceItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  indexCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E0E7FF',
    borderWidth: 1,
    borderColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  indexCircleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  studentCol: {
    flex: 1,
    marginRight: 8,
  },
  studentNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  studentNimText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  pressed: {
    opacity: 0.78,
  },
  feedbackSection: {
    marginTop: 24,
    marginBottom: 12,
  },
  aiHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  aiBadgePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4F46E5',
  },
  sentimentSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  sentimentChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  sentimentPos: {
    backgroundColor: '#DCFCE7',
  },
  sentimentNet: {
    backgroundColor: '#E0F2FE',
  },
  sentimentNeg: {
    backgroundColor: '#FEE2E2',
  },
  sentimentChipNum: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  sentimentChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  feedbackEmptyCard: {
    padding: 22,
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  feedbackEmptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
    marginBottom: 4,
  },
  feedbackEmptyDesc: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  feedbackList: {
    gap: 10,
  },
  feedbackCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0F172A',
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
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  feedbackDateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  feedbackCommentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 19,
    marginTop: 4,
    fontStyle: 'italic',
  },
});

export default SessionRecapScreen;
