/**
 * Lintang — Dedicated Praktikan Attendance Screen (Sprint 3)
 *
 * Layar khusus presensi praktikan dengan validasi geolokasi perangkat:
 * - Menampilkan detail jadwal (nama matkul, kelas, tanggal, waktu, ruang)
 * - Menampilkan status sesi praktikum real-time
 * - Mengambil koordinat GPS perangkat mahasiswa
 * - Menghitung jarak geodesik ke laboratorium menggunakan Haversine
 * - Memvalidasi batas radius presensi secara fail-closed
 * - Menampilkan indikator jarak, radius yang diizinkan, dan kelayakan presensi
 * - Menyimpan presensi secara atomik melalui Firestore transaction
 * - Sinkronisasi real-time status kehadiran praktikan
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { useFirestoreSchedules } from '@/hooks/useFirestoreSchedules';
import { useLaboratories } from '@/hooks/useLaboratories';
import { useStudentAttendanceLocation } from '@/hooks/useStudentAttendanceLocation';
import {
  submitPracticumAttendance,
  subscribeToStudentAttendanceForSchedule,
} from '@/services/attendanceService';
import type { AttendanceRecordItem } from '@/types/attendance';
import { AppHeader } from '@/components/AppHeader';
import { CustomButton } from '@/components/CustomButton';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
  APP_FONTS,
  APP_RADIUS,
  APP_SPACING,
  APP_SHADOWS,
} from '@/constants/theme';

interface StudentAttendanceScreenProps {
  navigation: NavigationProp;
}

export const StudentAttendanceScreen: React.FC<StudentAttendanceScreenProps> = ({
  navigation,
}) => {
  const { activeUser, activeScheduleId, activeRole } = useApp();

  // Ambil scheduleId dari navigasi params atau context
  const targetScheduleId = navigation.params?.scheduleId || activeScheduleId;

  // Langganan jadwal Firestore praktikan
  const { schedules, loading: schedulesLoading, error: schedulesError } =
    useFirestoreSchedules(activeUser.id, 'student');

  const currentSchedule =
    schedules.find((s) => s.id === targetScheduleId) || schedules[0];

  // Langganan data laboratorium
  const { laboratories, loading: labsLoading, error: labsError } = useLaboratories();

  // Sinkronisasi status kehadiran praktikan pada sesi ini
  const attendanceSubKey =
    currentSchedule?.id && activeUser?.id
      ? `${currentSchedule.id}_${activeUser.id}`
      : '';

  const [attendanceState, setAttendanceState] = useState<{
    key: string;
    record: AttendanceRecordItem | null;
  }>({ key: '', record: null });

  useEffect(() => {
    if (!attendanceSubKey || !currentSchedule?.id || !activeUser?.id) {
      return undefined;
    }
    const activeKey = attendanceSubKey;
    const unsubscribe = subscribeToStudentAttendanceForSchedule(
      currentSchedule.id,
      activeUser.id,
      (record) => setAttendanceState({ key: activeKey, record }),
      (err) => console.warn('Attendance listener error:', err),
    );
    return () => unsubscribe();
  }, [attendanceSubKey, currentSchedule?.id, activeUser?.id]);

  const studentRecord =
    attendanceSubKey && attendanceState.key === attendanceSubKey
      ? attendanceState.record
      : null;

  const isPresent = studentRecord?.status === 'Hadir';
  const isExcused = studentRecord?.status === 'Izin';
  const hasAttendanceRecord = isPresent || isExcused;

  // Validasi keikutsertaan mahasiswa dalam jadwal
  const isEnrolled =
    Boolean(currentSchedule) &&
    Array.isArray(currentSchedule.enrolledStudents) &&
    currentSchedule.enrolledStudents.includes(activeUser.id);

  // Hook validasi lokasi & radius
  const {
    checking: isLocationChecking,
    deviceLocationResult,
    labMatchResult,
    matchedLaboratory,
    radiusValidation,
    eligibility,
    checkLocation,
  } = useStudentAttendanceLocation({
    schedule: currentSchedule ?? null,
    laboratories,
    isEnrolled,
    hasAttendanceRecord,
  });

  // State proses submit presensi
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackModal, setFeedbackModal] = useState<{
    visible: boolean;
    success: boolean;
    message: string;
    timestamp?: string;
  }>({
    visible: false,
    success: false,
    message: '',
  });

  // Handler pengiriman presensi
  const handleSubmitAttendance = async () => {
    if (!currentSchedule) return;

    if (!eligibility.eligible) {
      setFeedbackModal({
        visible: true,
        success: false,
        message: eligibility.reason,
      });
      return;
    }

    if (!radiusValidation?.isWithinRadius || !matchedLaboratory || !deviceLocationResult?.coordinates) {
      setFeedbackModal({
        visible: true,
        success: false,
        message: 'Validasi lokasi belum terpenuhi. Pastikan Anda berada di laboratorium.',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await submitPracticumAttendance({
        scheduleId: currentSchedule.id,
        studentId: activeUser.id,
        studentName: activeUser.name,
        nim: activeUser.nim,
        locationValidation: {
          isWithinRadius: radiusValidation.isWithinRadius,
          distanceMeters: radiusValidation.distanceMeters,
          radiusMeters: radiusValidation.radiusMeters,
          laboratoryId: matchedLaboratory.id,
          laboratoryName: matchedLaboratory.name,
          latitude: deviceLocationResult.coordinates.latitude,
          longitude: deviceLocationResult.coordinates.longitude,
          accuracy: deviceLocationResult.coordinates.accuracy,
          validatedAt: new Date().toISOString(),
        },
      });

      setFeedbackModal({
        visible: true,
        success: true,
        message: res.message,
        timestamp: res.timestamp,
      });
    } catch (err) {
      setFeedbackModal({
        visible: true,
        success: false,
        message:
          err instanceof Error
            ? err.message
            : 'Presensi gagal dicatat. Silakan coba kembali.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // State loading jadwal
  if (schedulesLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <AppHeader title="Presensi Praktikum" onBack={() => navigation.goBack()} />
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={APP_COLORS.primary} />
          <Text style={styles.stateText}>Memuat data jadwal praktikum...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // State jadwal tidak ditemukan atau error
  if (schedulesError || !currentSchedule) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <AppHeader title="Presensi Praktikum" onBack={() => navigation.goBack()} />
        <View style={styles.centeredState}>
          <EmptyState
            icon="calendar-outline"
            title="Jadwal Tidak Ditemukan"
            description={
              schedulesError ||
              'Sesi praktikum tidak ditemukan atau akun Anda belum didaftarkan pada jadwal ini.'
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  // Teks dan warna status radius
  const getRadiusBadge = () => {
    if (isLocationChecking) {
      return {
        label: 'Memeriksa Lokasi...',
        bgColor: APP_COLORS.infoSoft,
        textColor: APP_COLORS.info,
        icon: 'locate-outline' as const,
      };
    }
    if (deviceLocationResult && !deviceLocationResult.success) {
      return {
        label: deviceLocationResult.errorCode === 'PERMISSION_DENIED'
          ? 'Izin GPS Ditolak'
          : deviceLocationResult.errorCode === 'SERVICES_DISABLED'
          ? 'GPS Nonaktif'
          : 'GPS Tidak Tersedia',
        bgColor: APP_COLORS.dangerSoft,
        textColor: APP_COLORS.danger,
        icon: 'alert-circle-outline' as const,
      };
    }
    if (!matchedLaboratory) {
      return {
        label: 'Lab Tidak Terhubung',
        bgColor: APP_COLORS.warningBg,
        textColor: APP_COLORS.warning,
        icon: 'warning-outline' as const,
      };
    }
    if (radiusValidation?.status === 'UNRELIABLE_ACCURACY') {
      return {
        label: 'Akurasi GPS Rendah',
        bgColor: APP_COLORS.warningBg,
        textColor: APP_COLORS.warning,
        icon: 'warning-outline' as const,
      };
    }
    if (radiusValidation?.isWithinRadius) {
      return {
        label: 'Dalam Radius',
        bgColor: APP_COLORS.openedSoft,
        textColor: APP_COLORS.opened,
        icon: 'checkmark-circle-outline' as const,
      };
    }
    return {
      label: 'Di Luar Radius',
      bgColor: APP_COLORS.dangerSoft,
      textColor: APP_COLORS.danger,
      icon: 'close-circle-outline' as const,
    };
  };

  const radiusBadge = getRadiusBadge();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      <AppHeader
        title="Presensi Praktikum"
        subtitle={`${currentSchedule.courseName} · ${currentSchedule.className}`}
        onBack={() => navigation.goBack()}
        onNotificationPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Hero Card Jadwal (#273287 + #D8E63C) */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroClassPill}>
              <Text style={styles.heroClassText}>{currentSchedule.className}</Text>
            </View>
            <StatusBadge status={currentSchedule.status} size="sm" />
          </View>

          <Text style={styles.heroCourseTitle} numberOfLines={2}>
            {currentSchedule.courseName}
          </Text>

          <View style={styles.heroMetaRow}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color="rgba(255,255,255,0.88)"
            />
            <Text style={styles.heroMetaText}>{currentSchedule.date}</Text>
          </View>

          <View style={styles.heroMetaRow}>
            <Ionicons
              name="time-outline"
              size={14}
              color="rgba(255,255,255,0.88)"
            />
            <Text style={styles.heroMetaText}>{currentSchedule.time} WIB</Text>
          </View>

          <View style={styles.heroMetaRow}>
            <Ionicons
              name="business-outline"
              size={14}
              color="rgba(255,255,255,0.88)"
            />
            <Text style={styles.heroMetaText}>
              Ruang: {currentSchedule.room || '-'}
            </Text>
          </View>

          {currentSchedule.assistantName ? (
            <View style={styles.heroMetaRow}>
              <Ionicons
                name="person-outline"
                size={14}
                color="rgba(255,255,255,0.88)"
              />
              <Text style={styles.heroMetaText}>
                Asisten: {currentSchedule.assistantName}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Status Presensi Jika Sudah Tercatat */}
        {hasAttendanceRecord && studentRecord && (
          <Card style={styles.attendedBanner}>
            <View style={styles.attendedRow}>
              <Ionicons
                name={isPresent ? 'checkmark-circle' : 'document-text'}
                size={24}
                color={isPresent ? APP_COLORS.opened : APP_COLORS.warning}
              />
              <View style={styles.attendedTextGroup}>
                <Text
                  style={[
                    styles.attendedTitle,
                    { color: isPresent ? APP_COLORS.opened : APP_COLORS.warning },
                  ]}>
                  {isPresent ? 'Presensi Tercatat Hadir' : 'Izin Praktikum Disetujui'}
                </Text>
                <Text style={styles.attendedSub}>
                  {studentRecord.date} pukul {studentRecord.timestamp}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Kartu Verifikasi Lokasi & Geofencing */}
        <Card style={styles.verificationCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderTitleGroup}>
              <Ionicons name="navigate-circle-outline" size={20} color={APP_COLORS.primary} />
              <Text style={styles.cardHeaderTitle}>Verifikasi Lokasi & Radius</Text>
            </View>
            <View
              style={[
                styles.radiusBadgePill,
                { backgroundColor: radiusBadge.bgColor },
              ]}>
              <Ionicons
                name={radiusBadge.icon}
                size={13}
                color={radiusBadge.textColor}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.radiusBadgeText, { color: radiusBadge.textColor }]}>
                {radiusBadge.label}
              </Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          {/* Rincian Laboratorium */}
          <View style={styles.infoRow}>
            <Text style={styles.infoRowLabel}>Laboratorium Tujuan</Text>
            <Text style={styles.infoRowValue} numberOfLines={1}>
              {matchedLaboratory ? matchedLaboratory.name : currentSchedule.room || '-'}
            </Text>
          </View>

          {matchedLaboratory && (matchedLaboratory.building || matchedLaboratory.floor) ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoRowLabel}>Gedung / Lantai</Text>
              <Text style={styles.infoRowValue}>
                {[
                  matchedLaboratory.building,
                  matchedLaboratory.floor ? `Lantai ${matchedLaboratory.floor}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          ) : null}

          {/* Jarak Geodesik & Radius */}
          <View style={styles.infoRow}>
            <Text style={styles.infoRowLabel}>Jarak dari Laboratorium</Text>
            <Text
              style={[
                styles.infoRowValue,
                radiusValidation?.isWithinRadius === true && styles.valueSuccess,
                radiusValidation?.isWithinRadius === false && styles.valueDanger,
              ]}>
              {isLocationChecking
                ? 'Menghitung...'
                : radiusValidation && !Number.isNaN(radiusValidation.distanceMeters)
                ? `${radiusValidation.distanceMeters} meter`
                : '-'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoRowLabel}>Radius Maksimal Diizinkan</Text>
            <Text style={styles.infoRowValue}>
              {matchedLaboratory && matchedLaboratory.radius > 0
                ? `${matchedLaboratory.radius} meter`
                : 'Belum diatur'}
            </Text>
          </View>

          {deviceLocationResult?.coordinates?.accuracy != null ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoRowLabel}>Akurasi Sinyal GPS</Text>
              <Text style={styles.infoRowValue}>
                ±{Math.round(deviceLocationResult.coordinates.accuracy)} meter
              </Text>
            </View>
          ) : null}

          {/* Pesan status validasi */}
          <View
            style={[
              styles.feedbackBanner,
              radiusValidation?.isWithinRadius
                ? styles.feedbackBannerSuccess
                : isLocationChecking
                ? styles.feedbackBannerInfo
                : styles.feedbackBannerWarning,
            ]}>
            <Ionicons
              name={
                radiusValidation?.isWithinRadius
                  ? 'checkmark-circle'
                  : isLocationChecking
                  ? 'information-circle'
                  : 'alert-circle'
              }
              size={18}
              color={
                radiusValidation?.isWithinRadius
                  ? APP_COLORS.opened
                  : isLocationChecking
                  ? APP_COLORS.info
                  : APP_COLORS.danger
              }
            />
            <Text
              style={[
                styles.feedbackBannerText,
                {
                  color: radiusValidation?.isWithinRadius
                    ? APP_COLORS.opened
                    : isLocationChecking
                    ? APP_COLORS.info
                    : APP_COLORS.danger,
                },
              ]}>
              {isLocationChecking
                ? 'Sedang memeriksa sinyal GPS dan mengukur jarak ke laboratorium...'
                : deviceLocationResult && !deviceLocationResult.success
                ? deviceLocationResult.errorMessage
                : labMatchResult && !labMatchResult.laboratory
                ? labMatchResult.message
                : radiusValidation
                ? radiusValidation.message
                : 'Lokasi belum dapat divalidasi.'}
            </Text>
          </View>

          {/* Tombol Periksa Ulang Lokasi */}
          <Pressable
            onPress={checkLocation}
            disabled={isLocationChecking}
            style={({ pressed }) => [
              styles.refreshLocationBtn,
              pressed && styles.pressed,
              isLocationChecking && styles.btnDisabled,
            ]}>
            {isLocationChecking ? (
              <ActivityIndicator size="small" color={APP_COLORS.primary} />
            ) : (
              <Ionicons name="refresh-outline" size={16} color={APP_COLORS.primary} />
            )}
            <Text style={styles.refreshLocationText}>
              {isLocationChecking ? 'Memeriksa Lokasi...' : 'Periksa Ulang Lokasi'}
            </Text>
          </Pressable>
        </Card>

        {/* Ringkasan Syarat Kelayakan Presensi */}
        <Card style={styles.eligibilityCard}>
          <Text style={styles.eligibilityCardTitle}>Syarat Presensi</Text>

          <View style={styles.checkItemRow}>
            <Ionicons
              name={
                currentSchedule.status === 'DIBUKA'
                  ? 'checkmark-circle'
                  : 'close-circle'
              }
              size={18}
              color={
                currentSchedule.status === 'DIBUKA'
                  ? APP_COLORS.opened
                  : APP_COLORS.danger
              }
            />
            <Text style={styles.checkItemText}>
              Status sesi praktikum: {currentSchedule.status}
              {currentSchedule.status !== 'DIBUKA' && ' (Sesi belum/tidak dibuka)'}
            </Text>
          </View>

          <View style={styles.checkItemRow}>
            <Ionicons
              name={isEnrolled ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={isEnrolled ? APP_COLORS.opened : APP_COLORS.danger}
            />
            <Text style={styles.checkItemText}>
              {isEnrolled
                ? 'Terdaftar sebagai peserta praktikum'
                : 'Tidak terdaftar dalam daftar peserta sesi ini'}
            </Text>
          </View>

          <View style={styles.checkItemRow}>
            <Ionicons
              name={
                radiusValidation?.isWithinRadius ? 'checkmark-circle' : 'close-circle'
              }
              size={18}
              color={
                radiusValidation?.isWithinRadius
                  ? APP_COLORS.opened
                  : APP_COLORS.danger
              }
            />
            <Text style={styles.checkItemText}>
              Posisi berada di dalam radius laboratorium
            </Text>
          </View>

          <View style={styles.checkItemRow}>
            <Ionicons
              name={!hasAttendanceRecord ? 'checkmark-circle' : 'information-circle'}
              size={18}
              color={
                !hasAttendanceRecord ? APP_COLORS.opened : APP_COLORS.warning
              }
            />
            <Text style={styles.checkItemText}>
              {!hasAttendanceRecord
                ? 'Belum melakukan presensi pada sesi ini'
                : 'Sudah melakukan presensi'}
            </Text>
          </View>
        </Card>

        {/* Action Button: Kirim Presensi */}
        <View style={styles.actionContainer}>
          {hasAttendanceRecord ? (
            <CustomButton
              title="Kembali ke Beranda"
              variant="outline"
              size="lg"
              onPress={() => navigation.navigate('StudentHome')}
            />
          ) : (
            <CustomButton
              title={
                isSubmitting
                  ? 'Menyimpan Presensi...'
                  : isLocationChecking
                  ? 'Menunggu Lokasi...'
                  : 'Kirim Presensi Sekarang'
              }
              variant="primary"
              size="lg"
              disabled={
                isSubmitting ||
                isLocationChecking ||
                !eligibility.eligible
              }
              loading={isSubmitting}
              leftIcon={
                !isSubmitting && !isLocationChecking ? (
                  <Ionicons
                    name="checkmark-done-circle-outline"
                    size={20}
                    color={APP_COLORS.white}
                  />
                ) : undefined
              }
              onPress={handleSubmitAttendance}
            />
          )}

          {!eligibility.eligible && !hasAttendanceRecord && !isLocationChecking && (
            <Text style={styles.ineligibleHint}>
              {eligibility.reason}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Modal Feedback Hasil Presensi */}
      <Modal
        visible={feedbackModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setFeedbackModal((prev) => ({ ...prev, visible: false }))
        }>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, APP_SHADOWS.modal]}>
            <View
              style={[
                styles.feedbackIconBox,
                feedbackModal.success
                  ? styles.feedbackSuccessBox
                  : styles.feedbackErrorBox,
              ]}>
              <Ionicons
                name={feedbackModal.success ? 'checkmark-circle' : 'alert-circle'}
                size={38}
                color={
                  feedbackModal.success ? APP_COLORS.opened : APP_COLORS.danger
                }
              />
            </View>
            <Text style={styles.modalFeedbackTitle}>
              {feedbackModal.success ? 'Presensi Berhasil' : 'Presensi Gagal'}
            </Text>
            <Text style={styles.modalFeedbackMessage}>
              {feedbackModal.message}
            </Text>

            {feedbackModal.timestamp ? (
              <View style={styles.modalTimeBox}>
                <Ionicons name="time-outline" size={15} color={APP_COLORS.primary} />
                <Text style={styles.modalTimeText}>
                  {feedbackModal.timestamp}
                </Text>
              </View>
            ) : null}

            <CustomButton
              title={feedbackModal.success ? 'Ke Halaman Utama' : 'Tutup'}
              variant="primary"
              size="md"
              onPress={() => {
                const wasSuccess = feedbackModal.success;
                setFeedbackModal((prev) => ({ ...prev, visible: false }));
                if (wasSuccess) {
                  navigation.navigate('StudentHome');
                }
              }}
            />
          </View>
        </View>
      </Modal>
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
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: APP_SPACING.md,
    padding: APP_SPACING.lg,
  },
  stateText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 14,
    color: APP_COLORS.textSecondary,
  },
  heroCard: {
    backgroundColor: APP_COLORS.intergalactic,
    borderRadius: APP_RADIUS.hero,
    padding: APP_SPACING.xl,
    marginBottom: APP_SPACING.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: APP_SPACING.sm,
  },
  heroClassPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: APP_RADIUS.pill,
  },
  heroClassText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.white,
  },
  heroCourseTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 19,
    lineHeight: 25,
    color: APP_COLORS.durantaYellow,
    marginBottom: 8,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  heroMetaText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    flex: 1,
  },
  attendedBanner: {
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.opened,
    padding: APP_SPACING.md,
    marginBottom: APP_SPACING.md,
  },
  attendedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_SPACING.sm,
  },
  attendedTextGroup: {
    flex: 1,
  },
  attendedTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 14,
  },
  attendedSub: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
  },
  verificationCard: {
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    padding: APP_SPACING.lg,
    marginBottom: APP_SPACING.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardHeaderTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 15,
    color: APP_COLORS.inkPrimary,
  },
  radiusBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: APP_RADIUS.pill,
  },
  radiusBadgeText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 11,
  },
  cardDivider: {
    height: 1,
    backgroundColor: APP_COLORS.divider,
    marginVertical: APP_SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  infoRowLabel: {
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
    flex: 1,
  },
  infoRowValue: {
    fontFamily: APP_FONTS.bold,
    fontSize: 13,
    color: APP_COLORS.inkPrimary,
    textAlign: 'right',
  },
  valueSuccess: {
    color: APP_COLORS.opened,
  },
  valueDanger: {
    color: APP_COLORS.danger,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: APP_RADIUS.md,
    padding: APP_SPACING.md,
    marginTop: APP_SPACING.md,
  },
  feedbackBannerSuccess: {
    backgroundColor: APP_COLORS.openedSoft,
  },
  feedbackBannerWarning: {
    backgroundColor: APP_COLORS.dangerSoft,
  },
  feedbackBannerInfo: {
    backgroundColor: APP_COLORS.infoSoft,
  },
  feedbackBannerText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  refreshLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: APP_RADIUS.md,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginTop: APP_SPACING.md,
    backgroundColor: APP_COLORS.surfaceSubtle,
  },
  refreshLocationText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.primary,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.7,
  },
  eligibilityCard: {
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    padding: APP_SPACING.lg,
    marginBottom: APP_SPACING.lg,
  },
  eligibilityCardTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
    marginBottom: APP_SPACING.sm,
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  checkItemText: {
    fontFamily: APP_FONTS.regular,
    fontSize: 13,
    color: APP_COLORS.textPrimary,
    flex: 1,
  },
  actionContainer: {
    gap: APP_SPACING.sm,
    marginBottom: APP_SPACING.xl,
  },
  ineligibleHint: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.danger,
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 24, 75, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: APP_SPACING.xl,
  },
  modalCard: {
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.modal,
    padding: APP_SPACING.xl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  feedbackIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: APP_SPACING.md,
  },
  feedbackSuccessBox: {
    backgroundColor: APP_COLORS.openedSoft,
  },
  feedbackErrorBox: {
    backgroundColor: APP_COLORS.dangerSoft,
  },
  modalFeedbackTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 17,
    color: APP_COLORS.inkPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  modalFeedbackMessage: {
    fontFamily: APP_FONTS.regular,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: APP_SPACING.lg,
  },
  modalTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: APP_COLORS.softBlue,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: APP_RADIUS.pill,
    marginBottom: APP_SPACING.lg,
  },
  modalTimeText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.primary,
  },
});

export default StudentAttendanceScreen;
