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
import { Card } from '@/components/Card';
import { CustomButton } from '@/components/CustomButton';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { AppHeader } from '@/components/AppHeader';
import { BottomNavigation } from '@/components/BottomNavigation';
import { SummaryTile } from '@/components/SummaryTile';
import { SentimentBadge } from '@/components/SentimentBadge';
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

interface SessionRecapScreenProps {
  navigation: NavigationProp;
}

export const SessionRecapScreen: React.FC<SessionRecapScreenProps> = ({
  navigation,
}) => {
  const {
    activeSchedule,
    activeUser,
  } = useApp();

  const { schedules, loading: schedulesLoading } = useFirestoreSchedules(
    activeUser.id,
    'assistant',
  );

  const [searchQuery, setSearchQuery] = useState('');

  const targetScheduleId = navigation.params?.scheduleId || activeSchedule?.id;
  const currentSchedule =
    schedules.find((s) => s.id === targetScheduleId) ||
    activeSchedule ||
    schedules[0];

  // Presensi real-time dari Cloud Firestore
  const {
    attendances,
    stats,
    loading: attendancesLoading,
  } = useRealtimeAttendance(
    currentSchedule?.id,
    currentSchedule?.totalStudents ?? 0,
  );

  // Feedback dan sentimen praktikan real-time dari Cloud Firestore
  const {
    feedbacks,
    loading: feedbacksLoading,
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Academic Blue Header */}
      <AppHeader
        title="Rekap Kehadiran"
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Session Info Card */}
        {currentSchedule && (
          <Card style={styles.sessionCard}>
            <View style={styles.sessionHeaderRow}>
              <View style={styles.sessionIconBox}>
                <Ionicons name="book" size={18} color={APP_COLORS.primary} />
              </View>
              <View style={styles.sessionTitleGroup}>
                <Text style={styles.courseName}>{currentSchedule.courseName}</Text>
                <Text style={styles.sessionMeta}>
                  {currentSchedule.className} • {currentSchedule.time} | {currentSchedule.room}
                </Text>
              </View>
              <StatusBadge status={currentSchedule.status} size="sm" />
            </View>
          </Card>
        )}

        {/* 4 Compact Summary Metrics dari data aktual Firestore */}
        <SummaryTile
          hadir={stats.hadirCount}
          izin={stats.izinCount}
          alfa={stats.alfaCount}
          total={stats.totalRegistered}
        />

        {/* Tombol Pemeriksaan Pengajuan Izin Sesi Ini (Fritz - Sprint 2) */}
        {currentSchedule && (
          <CustomButton
            title="Periksa Pengajuan Izin Sesi Ini (AI)"
            variant="secondary"
            size="md"
            leftIcon={
              <Ionicons
                name="document-text-outline"
                size={18}
                color={APP_COLORS.primary}
              />
            }
            rightIcon={
              <Ionicons
                name="chevron-forward"
                size={16}
                color={APP_COLORS.primary}
              />
            }
            onPress={() =>
              navigation.navigate('LeaveApproval', {
                scheduleId: currentSchedule.id,
              })
            }
          />
        )}

        {/* Section Daftar Mahasiswa */}
        <View style={styles.studentListSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Daftar Presensi Mahasiswa</Text>
            {attendancesLoading && (
              <ActivityIndicator size="small" color={APP_COLORS.primary} />
            )}
          </View>

          {/* Search Field */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={APP_COLORS.neutral500} />
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
                <Ionicons name="close-circle" size={16} color={APP_COLORS.neutral500} />
              </Pressable>
            )}
          </View>

          {/* Student Table or Empty State */}
          {filteredAttendanceLogs.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title={
                searchQuery.trim()
                  ? 'Mahasiswa Tidak Ditemukan'
                  : 'Belum Ada Mahasiswa Hadir'
              }
              description={
                searchQuery.trim()
                  ? `Tidak ada data presensi yang cocok dengan kata kunci "${searchQuery}".`
                  : 'Belum ada catatan presensi praktikan untuk sesi praktikum ini di Firestore.'
              }
            />
          ) : (
            <View style={styles.tableContainer}>
              {/* Table Header Row */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableColHeader, styles.colNo]}>No</Text>
                <Text style={[styles.tableColHeader, styles.colName]}>Nama</Text>
                <Text style={[styles.tableColHeader, styles.colTime]}>Waktu</Text>
                <Text style={[styles.tableColHeader, styles.colStatus]}>Status</Text>
              </View>

              {/* Table Data Rows */}
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
                    styles.tableDataRow,
                    index % 2 === 1 && styles.tableRowAlt,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.tableCellText, styles.colNo]}>{index + 1}</Text>
                  <View style={styles.colName}>
                    <Text style={styles.studentNameText} numberOfLines={1}>
                      {log.studentName}
                    </Text>
                    <Text style={styles.studentNimText}>NIM {log.nim}</Text>
                  </View>
                  <View style={styles.colTime}>
                    <Text style={styles.timeCellText}>{log.timestamp}</Text>
                  </View>
                  <View style={styles.colStatus}>
                    <StatusBadge status={log.status} size="sm" />
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Section Pesan & Kesan Peserta (AI Sentiment) */}
        <View style={styles.feedbackSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Pesan & Kesan Mahasiswa</Text>
            {feedbacksLoading && (
              <ActivityIndicator size="small" color={APP_COLORS.primary} />
            )}
          </View>

          {feedbacks.length === 0 ? (
            <Card style={styles.feedbackEmptyCard}>
              <Ionicons name="chatbubbles-outline" size={24} color={APP_COLORS.neutral400} />
              <Text style={styles.feedbackEmptyTitle}>Belum Ada Pesan & Kesan</Text>
              <Text style={styles.feedbackEmptyDesc}>
                Ulasan dan sentimen dari praktikan setelah sesi selesai akan muncul di sini secara real-time.
              </Text>
            </Card>
          ) : (
            <View style={styles.feedbackList}>
              {feedbacks.map((fb) => (
                <Card key={fb.id} style={styles.feedbackCard}>
                  <View style={styles.feedbackCardHeader}>
                    <View style={styles.feedbackAuthorCol}>
                      <Text style={styles.feedbackAuthorName}>{fb.studentName}</Text>
                      <Text style={styles.feedbackDateText}>{fb.createdAt || 'Baru saja'}</Text>
                    </View>
                    <SentimentBadge sentiment={fb.sentiment} size="sm" />
                  </View>
                  <Text style={styles.feedbackCommentText}>"{fb.comment}"</Text>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
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
    paddingTop: APP_SPACING.md,
    paddingBottom: APP_SPACING.xl,
  },
  sessionCard: {
    padding: APP_SPACING.md,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.sm,
  },
  sessionHeaderRow: {
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
  sessionTitleGroup: {
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
  studentListSection: {
    marginTop: APP_SPACING.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: APP_SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: 10,
    paddingHorizontal: APP_SPACING.md,
    height: 44,
    marginBottom: APP_SPACING.md,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: APP_SPACING.sm,
    fontSize: 13,
    color: APP_COLORS.navyHeading,
  },
  clearSearchBtn: {
    padding: 4,
  },
  tableContainer: {
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: APP_SPACING.md,
  },
  tableColHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: APP_COLORS.textSecondary,
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: APP_SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowAlt: {
    backgroundColor: '#FAFCFF',
  },
  colNo: {
    width: 28,
    textAlign: 'center',
  },
  colName: {
    flex: 1,
    paddingHorizontal: APP_SPACING.xs,
  },
  colTime: {
    width: 90,
  },
  colStatus: {
    width: 70,
    alignItems: 'flex-end',
  },
  tableCellText: {
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  timeCellText: {
    fontSize: 11,
    color: APP_COLORS.textSecondary,
  },
  studentNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: APP_COLORS.navyHeading,
  },
  studentNimText: {
    fontSize: 11,
    color: APP_COLORS.textMuted,
    marginTop: 1,
  },
  pressed: {
    opacity: 0.75,
  },
  feedbackSection: {
    marginTop: APP_SPACING.xl,
    marginBottom: APP_SPACING.lg,
  },
  feedbackEmptyCard: {
    padding: APP_SPACING.xl,
    alignItems: 'center',
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  feedbackEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
    marginTop: APP_SPACING.sm,
    marginBottom: 4,
  },
  feedbackEmptyDesc: {
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
  feedbackList: {
    gap: APP_SPACING.sm,
  },
  feedbackCard: {
    padding: APP_SPACING.md,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  feedbackCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: APP_SPACING.xs,
  },
  feedbackAuthorCol: {
    flex: 1,
  },
  feedbackAuthorName: {
    fontSize: 13,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
  },
  feedbackDateText: {
    fontSize: 11,
    color: APP_COLORS.textMuted,
    marginTop: 1,
  },
  feedbackCommentText: {
    fontSize: 13,
    color: APP_COLORS.textPrimary,
    lineHeight: 18,
    marginTop: 4,
    fontStyle: 'italic',
  },
});

export default SessionRecapScreen;
