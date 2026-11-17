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
import { useStudentAttendanceHistory } from '@/hooks/useStudentAttendanceHistory';
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

interface StudentHistoryScreenProps {
  navigation: NavigationProp;
}

export const StudentHistoryScreen: React.FC<StudentHistoryScreenProps> = ({
  navigation,
}) => {
  const { activeUser } = useApp();

  const {
    historyRecords,
    loading: historyLoading,
    error: historyError,
  } = useStudentAttendanceHistory(activeUser.id);

  const { schedules } = useFirestoreSchedules(activeUser.id, 'student');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('ALL');

  const enrichedLogs = useMemo(() => {
    return historyRecords.map((log) => {
      const schedule = schedules.find((s) => s.id === log.scheduleId);
      return {
        ...log,
        schedule,
      };
    });
  }, [historyRecords, schedules]);

  const uniqueCourses = useMemo(() => {
    const set = new Set<string>();
    enrichedLogs.forEach((log) => {
      if (log.schedule?.courseName) {
        set.add(log.schedule.courseName);
      }
    });
    return Array.from(set);
  }, [enrichedLogs]);

  const hadirCount = useMemo(
    () => enrichedLogs.filter((log) => log.status === 'Hadir').length,
    [enrichedLogs],
  );

  const izinCount = useMemo(
    () => enrichedLogs.filter((log) => log.status === 'Izin').length,
    [enrichedLogs],
  );

  const activeOrFinishedSchedulesCount = useMemo(
    () => schedules.filter((schedule) => schedule.status !== 'BELUM_DIBUKA').length,
    [schedules],
  );

  const attendancePercentage =
    activeOrFinishedSchedulesCount > 0
      ? Math.min(100, Math.round((hadirCount / activeOrFinishedSchedulesCount) * 100))
      : 0;

  const filteredLogs = useMemo(() => {
    return enrichedLogs.filter((log) => {
      const courseName = (log.schedule?.courseName || '').toLowerCase();
      const dateText = (log.date || '').toLowerCase();
      const timeText = (log.timestamp || '').toLowerCase();
      const query = searchQuery.toLowerCase().trim();

      const matchesSearch =
        !query ||
        courseName.includes(query) ||
        dateText.includes(query) ||
        timeText.includes(query);

      const matchesCourse =
        selectedCourseFilter === 'ALL' ||
        log.schedule?.courseName === selectedCourseFilter;

      return matchesSearch && matchesCourse;
    });
  }, [enrichedLogs, searchQuery, selectedCourseFilter]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title="Riwayat Kehadiran"
        subtitle={`${activeUser.name} · NIM ${activeUser.nim || '-'}`}
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Ringkasan Kehadiran (#273287 + #D8E63C) */}
        <View style={styles.summaryHeroCard}>
          <View style={styles.summaryTop}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {(activeUser.name || 'M').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>
                {activeUser.name}
              </Text>
              <Text style={styles.profileMeta}>
                NIM {activeUser.nim || '-'}
              </Text>
            </View>
          </View>

          <View style={styles.metricsStrip}>
            <View style={styles.metricCell}>
              <Text style={styles.metricVal}>{hadirCount}</Text>
              <Text style={styles.metricLabel}>Hadir</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricCell}>
              <Text style={styles.metricVal}>{izinCount}</Text>
              <Text style={styles.metricLabel}>Izin</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricCell}>
              <Text style={[styles.metricVal, styles.metricAccent]}>
                {attendancePercentage}%
              </Text>
              <Text style={styles.metricLabel}>Kehadiran</Text>
            </View>
          </View>
        </View>

        {/* Search Field */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={APP_COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari mata praktikum atau tanggal..."
            placeholderTextColor={APP_COLORS.neutral400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons
                name="close-circle"
                size={16}
                color={APP_COLORS.textSecondary}
              />
            </Pressable>
          )}
        </View>

        {/* Filter Chips */}
        {uniqueCourses.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContainer}>
            <Pressable
              onPress={() => setSelectedCourseFilter('ALL')}
              style={[
                styles.chip,
                selectedCourseFilter === 'ALL' && styles.chipActive,
              ]}>
              <Text
                style={[
                  styles.chipText,
                  selectedCourseFilter === 'ALL' && styles.chipTextActive,
                ]}>
                Semua
              </Text>
            </Pressable>
            {uniqueCourses.map((c) => (
              <Pressable
                key={c}
                onPress={() => setSelectedCourseFilter(c)}
                style={[
                  styles.chip,
                  selectedCourseFilter === c && styles.chipActive,
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    selectedCourseFilter === c && styles.chipTextActive,
                  ]}>
                  {c}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {historyLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={APP_COLORS.primary} />
            <Text style={styles.loadingText}>Memuat riwayat...</Text>
          </View>
        )}

        {!!historyError && !historyLoading && (
          <EmptyState
            icon="alert-circle-outline"
            title="Gagal Memuat Riwayat"
            description={historyError}
          />
        )}

        {!historyLoading && !historyError && filteredLogs.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title={searchQuery.trim() ? 'Tidak Ada Hasil' : 'Belum Ada Riwayat'}
            description={
              searchQuery.trim()
                ? `Tidak ada catatan yang cocok dengan "${searchQuery}".`
                : 'Riwayat presensi Anda akan tampil di sini.'
            }
          />
        ) : (
          <View style={styles.historyList}>
            {filteredLogs.map((log) => {
              const isExcused = log.status === 'Izin';
              return (
                <View key={log.id} style={styles.timelineItem}>
                  <View style={styles.timelineRail}>
                    <View
                      style={[
                        styles.timelineDot,
                        {
                          backgroundColor: isExcused
                            ? APP_COLORS.warning
                            : APP_COLORS.opened,
                        },
                      ]}
                    />
                    <View style={styles.timelineLine} />
                  </View>

                  <Pressable
                    onPress={() =>
                      navigation.navigate('AttendanceDetail', {
                        record: log,
                        schedule: log.schedule,
                      })
                    }
                    style={({ pressed }) => [
                      styles.historyCard,
                      pressed && styles.pressed,
                    ]}>
                    <View style={styles.historyRow}>
                      <View style={styles.historyTextCol}>
                        <Text style={styles.courseTitle} numberOfLines={1}>
                          {log.schedule?.courseName || 'Praktikum'}
                        </Text>
                        <Text style={styles.historyMeta}>
                          {log.date} · {log.timestamp}
                        </Text>
                      </View>
                      <StatusBadge status={log.status} size="sm" />
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <BottomNavigation
        role="student"
        activeTab="StudentHistory"
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
  summaryHeroCard: {
    padding: APP_SPACING.xl,
    borderRadius: APP_RADIUS.hero,
    backgroundColor: APP_COLORS.intergalactic,
    marginBottom: APP_SPACING.lg,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: APP_SPACING.md,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: APP_COLORS.nordicBreeze,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_SPACING.md,
  },
  avatarText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 16,
    color: APP_COLORS.tetsuKon,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontFamily: APP_FONTS.bold,
    fontSize: 16,
    color: APP_COLORS.white,
  },
  profileMeta: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 1,
  },
  metricsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: APP_RADIUS.md,
    paddingVertical: 10,
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
  metricVal: {
    fontFamily: APP_FONTS.bold,
    fontSize: 17,
    color: APP_COLORS.white,
  },
  metricAccent: {
    color: APP_COLORS.durantaYellow,
  },
  metricLabel: {
    fontFamily: APP_FONTS.medium,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 1,
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
    marginLeft: APP_SPACING.sm,
    fontFamily: APP_FONTS.regular,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: APP_SPACING.md,
  },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: APP_RADIUS.pill,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  chipActive: {
    backgroundColor: APP_COLORS.primary,
    borderColor: APP_COLORS.primary,
  },
  chipText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  chipTextActive: {
    color: APP_COLORS.white,
  },
  historyList: {
    gap: APP_SPACING.sm,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timelineRail: {
    width: 18,
    alignItems: 'center',
    paddingTop: 18,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: APP_COLORS.border,
    marginTop: 4,
  },
  historyCard: {
    flex: 1,
    marginLeft: 8,
    padding: APP_SPACING.lg,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_SPACING.sm,
  },
  historyTextCol: {
    flex: 1,
  },
  courseTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 15,
    color: APP_COLORS.inkPrimary,
    marginBottom: 2,
  },
  historyMeta: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: APP_SPACING.xxl,
    gap: APP_SPACING.sm,
  },
  loadingText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
  },
  pressed: {
    opacity: 0.78,
  },
});

export default StudentHistoryScreen;
