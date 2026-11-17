/**
 * LeaveRequestSection Component
 * Kartu ringkas pengajuan & status izin praktikan yang selalu sinkron dengan sesi terpilih.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { CustomButton } from '@/components/CustomButton';
import { StatusBadge } from '@/components/StatusBadge';
import { useStudentLeaveForSchedule } from '@/hooks/useRealtimeLeaveRequests';
import {
  submitLeaveRequest,
  validateLeaveReason,
} from '@/services/leaveRequestService';
import {
  APP_COLORS,
  APP_FONTS,
  APP_RADIUS,
  APP_SHADOWS,
  APP_SPACING,
} from '@/constants/theme';

interface LeaveRequestSectionProps {
  scheduleId: string;
  courseName?: string;
  className?: string;
  sessionStatus?: string;
  studentId: string;
  studentName: string;
  nim?: string;
  isAttended?: boolean;
  onNavigateToLeaveScreen?: () => void;
}

export const LeaveRequestSection: React.FC<LeaveRequestSectionProps> = ({
  scheduleId,
  courseName,
  className,
  sessionStatus,
  studentId,
  studentName,
  nim,
  isAttended = false,
  onNavigateToLeaveScreen,
}) => {
  const { leaveRequest, loading } = useStudentLeaveForSchedule(
    scheduleId,
    studentId,
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSessionFinished = sessionStatus === 'SELESAI';

  const handleOpenModal = () => {
    setReasonText('');
    setModalVisible(true);
  };

  const handleSubmitLeave = async () => {
    const validationErr = validateLeaveReason(reasonText);
    if (validationErr) {
      Alert.alert('Validasi Alasan Izin', validationErr);
      return;
    }

    try {
      setSubmitting(true);
      const res = await submitLeaveRequest({
        scheduleId,
        courseName,
        className,
        studentId,
        studentName,
        nim,
        reason: reasonText.trim(),
      });
      setModalVisible(false);
      setReasonText('');
      Alert.alert('Pengajuan Izin Terkirim', res.message);
    } catch (err) {
      Alert.alert(
        'Pengajuan Izin Gagal',
        err instanceof Error
          ? err.message
          : 'Gagal mengirim pengajuan izin.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card style={styles.card}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={APP_COLORS.primary} />
          <Text style={styles.loadingText}>Memuat status izin...</Text>
        </View>
      </Card>
    );
  }

  // Nama praktikum selalu mengikuti sesi yang dipilih
  const syncedCourseLabel = courseName
    ? `${courseName}${className ? ` · ${className}` : ''}`
    : leaveRequest?.courseName
    ? `${leaveRequest.courseName}${
        leaveRequest.className ? ` · ${leaveRequest.className}` : ''
      }`
    : '';

  // Kondisi 1: Mahasiswa sudah mengajukan izin -> Tampilkan status ringkas + tombol riwayat
  if (leaveRequest) {
    return (
      <Card style={styles.card}>
        <View style={styles.statusHeaderRow}>
          <View style={styles.titleTextCol}>
            <Text style={styles.cardTitle}>Status Pengajuan Izin</Text>
            {syncedCourseLabel ? (
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                {syncedCourseLabel}
              </Text>
            ) : null}
          </View>
          <StatusBadge status={leaveRequest.status} size="sm" />
        </View>

        {onNavigateToLeaveScreen && (
          <View style={styles.compactFooter}>
            <CustomButton
              title="Lihat Riwayat Pengajuan Izin"
              variant="secondary"
              size="sm"
              fullWidth={false}
              rightIcon={
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={APP_COLORS.inkPrimary}
                />
              }
              onPress={onNavigateToLeaveScreen}
            />
          </View>
        )}
      </Card>
    );
  }

  // Kondisi 2: Mahasiswa sudah tercatat Hadir
  if (isAttended) {
    return null;
  }

  // Kondisi 3: Belum mengajukan izin
  return (
    <>
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.iconBox}>
            <Ionicons
              name="document-text-outline"
              size={18}
              color={APP_COLORS.primary}
            />
          </View>
          <View style={styles.titleTextCol}>
            <Text style={styles.cardTitle}>Pengajuan Izin</Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {isSessionFinished
                ? 'Sesi selesai. Pengajuan ditutup.'
                : 'Berhalangan hadir pada sesi ini?'}
            </Text>
          </View>
        </View>

        <View style={styles.compactActionsRow}>
          {!isSessionFinished && (
            <CustomButton
              title="Ajukan Izin"
              variant="secondary"
              size="sm"
              fullWidth={false}
              leftIcon={
                <Ionicons
                  name="create-outline"
                  size={15}
                  color={APP_COLORS.inkPrimary}
                />
              }
              onPress={handleOpenModal}
            />
          )}

          {onNavigateToLeaveScreen && (
            <CustomButton
              title="Riwayat Izin"
              variant="outline"
              size="sm"
              fullWidth={false}
              rightIcon={
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={APP_COLORS.inkPrimary}
                />
              }
              onPress={onNavigateToLeaveScreen}
            />
          )}
        </View>
      </Card>

      {/* Modal Form Pengajuan Izin */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!submitting) setModalVisible(false);
        }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, APP_SHADOWS.modal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajukan Izin</Text>
              <Pressable
                disabled={submitting}
                onPress={() => setModalVisible(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Tutup modal"
                style={styles.closeModalBtn}>
                <Ionicons name="close" size={20} color={APP_COLORS.textSecondary} />
              </Pressable>
            </View>

            {syncedCourseLabel ? (
              <View style={styles.sessionSummaryPill}>
                <Ionicons name="book-outline" size={14} color={APP_COLORS.primary} />
                <Text style={styles.sessionSummaryText} numberOfLines={1}>
                  {syncedCourseLabel}
                </Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>Alasan Ketidakhadiran *</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Contoh: Sakit demam, ada surat dokter..."
              placeholderTextColor={APP_COLORS.neutral400}
              multiline
              numberOfLines={4}
              maxLength={500}
              value={reasonText}
              onChangeText={setReasonText}
              editable={!submitting}
              textAlignVertical="top"
            />
            <Text style={styles.charCountText}>{reasonText.trim().length}/500</Text>

            <Text style={styles.manualNoteText}>
              Status awal MENUNGGU dan diperiksa manual oleh asisten.
            </Text>

            <View style={styles.modalActions}>
              <View style={styles.modalBtnCol}>
                <CustomButton
                  title="Batal"
                  variant="outline"
                  size="md"
                  disabled={submitting}
                  onPress={() => setModalVisible(false)}
                />
              </View>
              <View style={styles.modalBtnCol}>
                <CustomButton
                  title={submitting ? 'Mengirim...' : 'Kirim Izin'}
                  variant="primary"
                  size="md"
                  loading={submitting}
                  disabled={submitting}
                  onPress={handleSubmitLeave}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: APP_SPACING.lg,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.md,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_SPACING.sm,
    paddingVertical: APP_SPACING.xs,
  },
  loadingText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: APP_SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_SPACING.sm,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: APP_COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleTextCol: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 15,
    color: APP_COLORS.inkPrimary,
  },
  cardSubtitle: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
  },
  compactFooter: {
    marginTop: APP_SPACING.md,
  },
  compactActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: APP_SPACING.sm,
    marginTop: APP_SPACING.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 24, 75, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: APP_SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.modal,
    padding: APP_SPACING.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: APP_SPACING.sm,
  },
  modalTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 18,
    color: APP_COLORS.inkPrimary,
  },
  closeModalBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: APP_COLORS.softBlue,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: APP_SPACING.md,
  },
  sessionSummaryText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.primary,
    flex: 1,
  },
  inputLabel: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 13,
    color: APP_COLORS.inkPrimary,
    marginBottom: 6,
  },
  textArea: {
    fontFamily: APP_FONTS.regular,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: APP_RADIUS.md,
    padding: APP_SPACING.md,
    minHeight: 92,
    fontSize: 14,
    lineHeight: 20,
    color: APP_COLORS.inkPrimary,
    backgroundColor: APP_COLORS.surfaceSubtle,
  },
  charCountText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 11,
    color: APP_COLORS.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  manualNoteText: {
    fontFamily: APP_FONTS.regular,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: APP_SPACING.xs,
    marginBottom: APP_SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: APP_SPACING.sm,
  },
  modalBtnCol: {
    flex: 1,
  },
});

export default LeaveRequestSection;
