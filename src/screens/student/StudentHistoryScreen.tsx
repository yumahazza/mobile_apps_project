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
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { AppHeader } from '@/components/AppHeader';
import { BottomNavigation } from '@/components/BottomNavigation';
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
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

  // Ambil riwayat presensi mahasiswa langsung dari Cloud Firestore (attendances)
  const {
    historyRecords,
    loading: historyLoading,
    error: historyError,
  } = useStudentAttendanceHistory(activeUser.id);

  // Ambil daftar jadwal untuk resolusi nama mata praktikum
  const { schedules } = useFirestoreSchedules(activeUser.id, 'student');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('ALL');

  // Gabungkan attendance record dengan metadata schedule
  const enrichedLogs = useMemo(() => {
    return historyRecords.map(log => {
      const schedule = schedules.find(s => s.id === log.scheduleId);
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
      {/* Top Academic Blue Header */}
      <AppHeader
        title="Riwayat Kehadiran"
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Student Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {(activeUser.name || 'M').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{activeUser.name}</Text>
              <Text style={styles.profileMeta}>NIM {activeUser.nim || '-'}</Text>
            </View>
          </View>

          {/* Metrics Tiles dari data riwayat Firestore */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricTile}>
              <Text style={styles.metricVal}>{enrichedLogs.length}</Text>
              <Text style={styles.metricLabel}>Total Hadir</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricVal}>
                {schedules.length > 0
                  ? `${Math.round((enrichedLogs.length / schedules.length) * 100)}%`
                  : '100%'}
              </Text>
              <Text style={styles.metricLabel}>Kehadiran</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricVal}>Aktif</Text>
              <Text style={styles.metricLabel}>Status</Text>
            </View>
          </View>
        </Card>

        {/* Search Field */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={APP_COLORS.neutral500} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari riwayat kehadiran..."
            placeholderTextColor={APP_COLORS.neutral400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={APP_COLORS.neutral500} />
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

        {/* Loading State */}
        {historyLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={APP_COLORS.primary} />
            <Text style={styles.loadingText}>Memuat riwayat kehadiran dari Firestore...</Text>
          </View>
        )}

        {/* Error State */}
        {!!historyError && !historyLoading && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={24} color={APP_COLORS.danger} />
            <Text style={styles.errorText}>{historyError}</Text>
          </View>
        )}

        {/* History List or Empty State */}
        {!historyLoading && !historyError && filteredLogs.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title={
              searchQuery.trim()
                ? 'Tidak Ada Hasil'
                : 'Belum Ada Riwayat Presensi'
            }
            description={
              searchQuery.trim()
                ? `Tidak ditemukan riwayat yang sesuai dengan "${searchQuery}".`
                : 'Anda belum memiliki riwayat presensi yang tercatat di Cloud Firestore.'
            }
          />
        ) : (
          <View style={styles.historyList}>
            {filteredLogs.map((log) => (
              <Card
                key={log.id}
                onPress={() =>
                  navigation.navigate('AttendanceDetail', {
                    record: log,
                    schedule: log.schedule,
                  })
                }
                style={styles.historyCard}>
                <View style={styles.historyRow}>
                  <View style={styles.iconBox}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={APP_COLORS.opened}
                    />
                  </View>
                  <View style={styles.historyTextCol}>
                    <Text style={styles.courseTitle}>
                      {log.schedule?.courseName || 'Praktikum'}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {log.date} • {log.timestamp}
                    </Text>
                  </View>
                  <StatusBadge status={log.status} size="sm" />
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
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
    paddingTop: APP_SPACING.md,
    paddingBottom: APP_SPACING.xl,
  },
  profileCard: {
    padding: APP_SPACING.lg,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: APP_SPACING.md,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: APP_COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_SPACING.md,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: APP_COLORS.primary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
  },
  profileMeta: {
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: APP_SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: APP_SPACING.md,
  },
  metricTile: {
    flex: 1,
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 16,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
  },
  metricLabel: {
    fontSize: 11,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
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
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: APP_SPACING.md,
  },
  chip: {
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
    fontSize: 12,
    fontWeight: '600',
    color: APP_COLORS.textSecondary,
  },
  chipTextActive: {
    color: APP_COLORS.white,
  },
  historyList: {
    gap: APP_SPACING.sm,
  },
  historyCard: {
    padding: APP_SPACING.md,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    marginRight: APP_SPACING.md,
  },
  historyTextCol: {
    flex: 1,
  },
  courseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
    marginBottom: 2,
  },
  historyMeta: {
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
    fontSize: 13,
    color: APP_COLORS.textSecondary,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_SPACING.sm,
    backgroundColor: '#FEE2E2',
    padding: APP_SPACING.md,
    borderRadius: APP_RADIUS.card,
    marginBottom: APP_SPACING.md,
  },
  errorText: {
    fontSize: 13,
    color: APP_COLORS.danger,
    flex: 1,
  },
});

export default StudentHistoryScreen;
