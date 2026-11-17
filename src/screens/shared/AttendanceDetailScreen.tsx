import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { AppHeader } from '@/components/AppHeader';
import { BottomNavigation } from '@/components/BottomNavigation';
import type { AttendanceRecordItem } from '@/types/attendance';
import type { PracticumSchedule } from '@/services/practicumScheduleService';
import type { Schedule } from '@/data/schedules';
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
  APP_FONTS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

interface AttendanceDetailScreenProps {
  navigation: NavigationProp;
}

export const AttendanceDetailScreen: React.FC<AttendanceDetailScreenProps> = ({
  navigation,
}) => {
  const { activeRole } = useApp();

  const record = navigation.params?.record as AttendanceRecordItem | undefined;
  const schedule = navigation.params?.schedule as
    | PracticumSchedule
    | Schedule
    | undefined;

  if (!record) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <AppHeader
          title="Detail Presensi"
          onBack={() => navigation.goBack()}
          onNotificationPress={() => navigation.navigate('Notifications')}
        />
        <View style={styles.emptyWrapper}>
          <EmptyState
            icon="document-text-outline"
            title="Detail Tidak Tersedia"
            description="Pilih catatan kehadiran dari rekap atau riwayat."
            actionTitle="Kembali"
            onActionPress={() => navigation.goBack()}
          />
        </View>
        <BottomNavigation
          role={activeRole}
          activeTab={activeRole === 'assistant' ? 'SessionRecap' : 'StudentHistory'}
          onTabChange={(tabKey) => navigation.navigate(tabKey)}
        />
      </SafeAreaView>
    );
  }

  const isExcused = record.status === 'Izin';
  const isAlfa = record.status === 'Alfa';

  const methodText = isExcused
    ? 'Izin Disetujui Asisten'
    : isAlfa
    ? 'Belum Tercatat'
    : 'Presensi Mandiri';

  const noteText = isExcused
    ? 'Izin ketidakhadiran disetujui'
    : isAlfa
    ? 'Tidak melakukan presensi'
    : 'Hadir pada sesi berlangsung';

  const initials = (record.studentName || 'M')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title="Detail Presensi"
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Card style={styles.studentCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <Text style={styles.studentNameText}>{record.studentName}</Text>
          <Text style={styles.studentNimText}>NIM {record.nim}</Text>
        </Card>

        <Card style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Informasi Kehadiran</Text>

          {schedule && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Praktikum</Text>
              <Text style={styles.detailValue}>{schedule.courseName}</Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <StatusBadge status={record.status} size="sm" />
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Waktu</Text>
            <Text style={styles.detailValue}>{record.timestamp}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tanggal</Text>
            <Text style={styles.detailValue}>{record.date}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Metode</Text>
            <Text style={styles.detailValue}>{methodText}</Text>
          </View>

          <View style={[styles.detailRow, styles.lastRow]}>
            <Text style={styles.detailLabel}>Keterangan</Text>
            <Text style={styles.detailValue}>{noteText}</Text>
          </View>
        </Card>

        <View style={styles.infoCallout}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={APP_COLORS.primary}
            style={styles.infoIcon}
          />
          <Text style={styles.infoCalloutText}>
            {isExcused
              ? 'Status izin disinkronkan dari persetujuan asisten.'
              : 'Data kehadiran tersimpan di sistem presensi.'}
          </Text>
        </View>
      </ScrollView>

      <BottomNavigation
        role={activeRole}
        activeTab={activeRole === 'assistant' ? 'SessionRecap' : 'StudentHistory'}
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
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: APP_SPACING.lg,
  },
  studentCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: APP_SPACING.xl,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.md,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: APP_COLORS.nordicBreeze,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: APP_SPACING.md,
  },
  avatarInitials: {
    fontFamily: APP_FONTS.bold,
    fontSize: 20,
    color: APP_COLORS.tetsuKon,
  },
  studentNameText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 18,
    color: APP_COLORS.inkPrimary,
    marginBottom: 2,
  },
  studentNimText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
  },
  infoCard: {
    padding: APP_SPACING.lg,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.md,
  },
  infoCardTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 15,
    color: APP_COLORS.inkPrimary,
    marginBottom: APP_SPACING.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: APP_SPACING.md,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.divider,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
  },
  detailValue: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 13,
    color: APP_COLORS.inkPrimary,
    flexShrink: 1,
    textAlign: 'right',
  },
  infoCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_COLORS.softBlue,
    borderRadius: APP_RADIUS.md,
    padding: APP_SPACING.md,
  },
  infoIcon: {
    marginRight: APP_SPACING.sm,
  },
  infoCalloutText: {
    flex: 1,
    fontFamily: APP_FONTS.regular,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    lineHeight: 18,
  },
});

export default AttendanceDetailScreen;
