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
import { ParticipantRoster } from '@/components/ParticipantRoster';
import { Card } from '@/components/Card';
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

interface StudentListScreenProps {
  navigation: NavigationProp;
}

export const StudentListScreen: React.FC<StudentListScreenProps> = ({
  navigation,
}) => {
  const {
    activeUser,
    activeScheduleId,
    activeRole,
  } = useApp();
  const { schedules, loading: schedulesLoading, error: schedulesError } =
    useFirestoreSchedules(activeUser.id, 'assistant');
  const [searchQuery, setSearchQuery] = useState('');

  const targetScheduleId = navigation.params?.scheduleId || activeScheduleId;
  const currentSchedule =
    schedules.find((schedule) => schedule.id === targetScheduleId) || schedules[0];

  const {
    attendances: attendanceLogs,
    loading: attendancesLoading,
    error: attendancesError,
  } = useRealtimeAttendance(
    currentSchedule?.id,
    currentSchedule?.totalStudents ?? 0,
  );

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return attendanceLogs;
    const q = searchQuery.toLowerCase().trim();
    return attendanceLogs.filter(
      (log) =>
        log.studentName.toLowerCase().includes(q) ||
        (log.nim && log.nim.toLowerCase().includes(q)),
    );
  }, [attendanceLogs, searchQuery]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title="Daftar Mahasiswa"
        subtitle={
          currentSchedule
            ? `${currentSchedule.courseName} · ${currentSchedule.className}`
            : 'Peserta & presensi'
        }
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {currentSchedule && (
          <Card style={styles.sessionCard}>
            <View style={styles.sessionRow}>
              <View style={styles.iconBox}>
                <Ionicons name="book-outline" size={18} color={APP_COLORS.primary} />
              </View>
              <View style={styles.sessionTextCol}>
                <Text style={styles.courseName}>{currentSchedule.courseName}</Text>
                <Text style={styles.sessionMeta}>
                  {currentSchedule.time} · {currentSchedule.room}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {schedulesLoading && (
          <Text style={styles.loadingMessage}>Memuat jadwal...</Text>
        )}
        {!!schedulesError && (
          <Text style={styles.errorMessage}>{schedulesError}</Text>
        )}

        {currentSchedule && <ParticipantRoster schedule={currentSchedule} />}

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={APP_COLORS.textSecondary} />
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
              style={styles.clearBtn}>
              <Ionicons
                name="close-circle"
                size={16}
                color={APP_COLORS.textSecondary}
              />
            </Pressable>
          )}
        </View>

        {attendancesError ? (
          <Text style={styles.errorMessage}>{attendancesError}</Text>
        ) : attendancesLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={APP_COLORS.primary} />
            <Text style={styles.loadingRowText}>Memuat presensi...</Text>
          </View>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title={
              searchQuery.trim()
                ? 'Mahasiswa Tidak Ditemukan'
                : 'Belum Ada Presensi'
            }
            description={
              searchQuery.trim()
                ? `Tidak ada data untuk "${searchQuery}".`
                : 'Belum ada data kehadiran pada sesi ini.'
            }
          />
        ) : (
          <View style={styles.tableCard}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableColTitle, styles.colNo]}>No</Text>
              <Text style={[styles.tableColTitle, styles.colName]}>Nama</Text>
              <Text style={[styles.tableColTitle, styles.colStatus]}>Status</Text>
              <Text style={[styles.tableColTitle, styles.colTime]}>Waktu</Text>
            </View>

            {filteredLogs.map((log, index) => {
              const formattedTime = log.timestamp
                ? log.timestamp.replace(' WIB', '')
                : '-';

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
                    styles.tableRow,
                    index % 2 === 1 && styles.tableRowAlt,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.cellText, styles.colNo]}>{index + 1}</Text>
                  <View style={styles.colName}>
                    <Text style={styles.studentNameText} numberOfLines={1}>
                      {log.studentName}
                    </Text>
                    <Text style={styles.studentNimText}>NIM {log.nim}</Text>
                  </View>
                  <View style={styles.colStatus}>
                    <StatusBadge status={log.status} size="sm" />
                  </View>
                  <Text style={[styles.timeCellText, styles.colTime]}>
                    {formattedTime}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <BottomNavigation
        role={activeRole}
        activeTab="ScheduleList"
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
  sessionCard: {
    padding: APP_SPACING.lg,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.md,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: APP_COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_SPACING.md,
  },
  sessionTextCol: {
    flex: 1,
  },
  courseName: {
    fontFamily: APP_FONTS.bold,
    fontSize: 15,
    color: APP_COLORS.inkPrimary,
    marginBottom: 2,
  },
  sessionMeta: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
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
  clearBtn: {
    padding: 4,
  },
  tableCard: {
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_COLORS.surfaceSubtle,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: APP_SPACING.md,
  },
  tableColTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: APP_SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.divider,
  },
  tableRowAlt: {
    backgroundColor: APP_COLORS.surfaceSubtle,
  },
  colNo: {
    width: 28,
    textAlign: 'center',
  },
  colName: {
    flex: 1,
    paddingHorizontal: APP_SPACING.sm,
  },
  colStatus: {
    width: 78,
    alignItems: 'center',
  },
  colTime: {
    width: 60,
    textAlign: 'right',
  },
  cellText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
  },
  timeCellText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  studentNameText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
  },
  studentNimText: {
    fontFamily: APP_FONTS.regular,
    fontSize: 11,
    color: APP_COLORS.textMuted,
    marginTop: 1,
  },
  pressed: {
    opacity: 0.78,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_SPACING.sm,
    marginBottom: 12,
  },
  loadingRowText: {
    fontFamily: APP_FONTS.medium,
    color: APP_COLORS.textSecondary,
    fontSize: 12,
  },
  loadingMessage: {
    fontFamily: APP_FONTS.medium,
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 12,
  },
  errorMessage: {
    fontFamily: APP_FONTS.medium,
    color: APP_COLORS.dangerText,
    fontSize: 12,
    marginBottom: 12,
  },
});

export default StudentListScreen;
