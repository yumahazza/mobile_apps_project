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
            title="Detail Kehadiran Tidak Tersedia"
            description="Pilih salah satu catatan kehadiran dari rekap sesi atau riwayat presensi."
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
    ? 'Pengajuan Izin (Disetujui Asisten)'
    : isAlfa
    ? 'Belum Tercatat'
    : 'Presensi Mandiri (Mobile App)';

  const noteText = isExcused
    ? 'Izin ketidakhadiran disetujui oleh asisten'
    : isAlfa
    ? 'Tidak melakukan presensi pada sesi ini'
    : 'Kehadiran tercatat pada sesi berlangsung';

  const calloutText = isExcused
    ? 'Status Izin ini disinkronkan secara otomatis dari persetujuan asisten di Cloud Firestore.'
    : 'Presensi tercatat dengan benar dan telah tersimpan di Cloud Firestore.';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Academic Blue Header */}
      <AppHeader
        title="Detail Presensi"
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Student Avatar Card */}
        <Card style={styles.studentCard}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={32} color={APP_COLORS.primary} />
          </View>
          <Text style={styles.studentNameText}>{record.studentName}</Text>
          <Text style={styles.studentNimText}>NIM {record.nim}</Text>
        </Card>

        {/* Attendance Information Card */}
        <Card style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Informasi Kehadiran</Text>

          {/* Praktikum */}
          {schedule && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Praktikum</Text>
              <Text style={styles.detailValue}>{schedule.courseName}</Text>
            </View>
          )}

          {/* Status */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <StatusBadge status={record.status} size="sm" />
          </View>

          {/* Waktu Presensi */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Waktu Tercatat</Text>
            <Text style={styles.detailValue}>{record.timestamp}</Text>
          </View>

          {/* Tanggal */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tanggal</Text>
            <Text style={styles.detailValue}>{record.date}</Text>
          </View>

          {/* Metode */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Metode</Text>
            <Text style={styles.detailValue}>{methodText}</Text>
          </View>

          {/* Keterangan */}
          <View style={[styles.detailRow, styles.lastRow]}>
            <Text style={styles.detailLabel}>Keterangan</Text>
            <Text style={styles.detailValue}>{noteText}</Text>
          </View>
        </Card>

        {/* Blue Info Confirmation Callout */}
        <View style={styles.infoCallout}>
          <Ionicons
            name="information-circle"
            size={20}
            color={APP_COLORS.primary}
            style={styles.infoIcon}
          />
          <Text style={styles.infoCalloutText}>{calloutText}</Text>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
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
    paddingTop: APP_SPACING.md,
    paddingBottom: APP_SPACING.xl,
  },
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: APP_SPACING.lg,
  },
  studentCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: APP_SPACING.xxl,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.md,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: APP_COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: APP_SPACING.md,
  },
  studentNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
    marginBottom: 4,
  },
  studentNimText: {
    fontSize: 13,
    color: APP_COLORS.textSecondary,
  },
  infoCard: {
    padding: APP_SPACING.lg,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.lg,
  },
  infoCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
    marginBottom: APP_SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 13,
    color: APP_COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: APP_COLORS.navyHeading,
  },
  infoCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_COLORS.softBlue,
    borderWidth: 1,
    borderColor: APP_COLORS.lightBlue,
    borderRadius: 10,
    padding: APP_SPACING.md,
  },
  infoIcon: {
    marginRight: APP_SPACING.sm,
  },
  infoCalloutText: {
    flex: 1,
    fontSize: 12,
    color: APP_COLORS.textPrimary,
    lineHeight: 18,
  },
});

export default AttendanceDetailScreen;
