/**
 * Fritz — LeaveRequestSection Component (Sprint 2)
 *
 * Fitur Pengajuan Izin & Pemantauan Status Izin Real-time untuk Praktikan:
 * - Memungkinkan praktikan mengajukan izin ketidakhadiran pada sesi praktikum tertentu (Kebutuhan #9)
 * - Mencegah pengajuan izin ganda pada sesi yang sama (Kebutuhan #10)
 * - Menampilkan status pengajuan izin ('MENUNGGU', 'DITERIMA', 'DITOLAK') secara real-time
 *   menggunakan onSnapshot beserta badge hasil klasifikasi AI (Kebutuhan #10)
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
          : 'Gagal mengirim pengajuan izin ke Cloud Firestore.',
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
          <Text style={styles.loadingText}>Memuat status pengajuan izin...</Text>
        </View>
      </Card>
    );
  }

  // Kondisi 1: Mahasiswa sudah mengajukan izin pada sesi ini -> Tampilkan status real-time
  if (leaveRequest) {
    return (
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <View style={styles.iconBox}>
              <Ionicons
                name="document-text-outline"
                size={18}
                color={APP_COLORS.primary}
              />
            </View>
            <View style={styles.titleTextCol}>
              <Text style={styles.cardTitle}>Status Pengajuan Izin</Text>
              <Text style={styles.cardSubtitle}>
                {leaveRequest.createdAt || 'Tersimpan di Cloud Firestore'}
              </Text>
            </View>
          </View>
          <StatusBadge status={leaveRequest.status} size="sm" />
        </View>

        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Alasan Ketidakhadiran:</Text>
          <Text style={styles.reasonValue}>&quot;{leaveRequest.reason}&quot;</Text>
        </View>

        <View style={styles.statusExplanationBox}>
          <Ionicons
            name={
              leaveRequest.status === 'DITERIMA'
                ? 'checkmark-circle'
                : leaveRequest.status === 'DITOLAK'
                ? 'close-circle'
                : 'time'
            }
            size={16}
            color={
              leaveRequest.status === 'DITERIMA'
                ? APP_COLORS.opened
                : leaveRequest.status === 'DITOLAK'
                ? APP_COLORS.error
                : APP_COLORS.notOpened
            }
          />
          <Text style={styles.statusExplanationText}>
            {leaveRequest.status === 'MENUNGGU'
              ? 'Pengajuan izin Anda berstatus MENUNGGU dan akan direview serta ditentukan statusnya secara manual oleh Asisten Praktikum.'
              : leaveRequest.status === 'DITERIMA'
              ? 'Pengajuan izin Anda telah DITERIMA oleh Asisten Praktikum. Kehadiran Anda tercatat sebagai Izin.'
              : 'Pengajuan izin Anda DITOLAK oleh Asisten Praktikum.'}
          </Text>
        </View>

        {onNavigateToLeaveScreen && (
          <Pressable
            onPress={onNavigateToLeaveScreen}
            style={({ pressed }) => [
              styles.linkRow,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.linkText}>Lihat Semua Riwayat Izin Saya</Text>
            <Ionicons name="chevron-forward" size={14} color={APP_COLORS.primary} />
          </Pressable>
        )}
      </Card>
    );
  }

  // Kondisi 2: Mahasiswa sudah tercatat Hadir
  if (isAttended) {
    return null;
  }

  // Kondisi 3: Belum mengajukan izin -> Tampilkan kartu pengajuan izin
  return (
    <>
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <View style={styles.iconBox}>
              <Ionicons
                name="document-text-outline"
                size={18}
                color={APP_COLORS.primary}
              />
            </View>
            <View style={styles.titleTextCol}>
              <Text style={styles.cardTitle}>Berhalangan Hadir?</Text>
              <Text style={styles.cardSubtitle}>
                {isSessionFinished
                  ? 'Sesi praktikum telah selesai. Pengajuan izin sudah ditutup.'
                  : 'Ajukan izin ketidakhadiran beserta alasan untuk diperiksa oleh asisten.'}
              </Text>
            </View>
          </View>
        </View>

        {!isSessionFinished && (
          <View style={styles.actionRow}>
            <CustomButton
              title="Ajukan Izin Praktikum"
              variant="secondary"
              size="md"
              leftIcon={
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={APP_COLORS.primary}
                />
              }
              onPress={handleOpenModal}
            />
          </View>
        )}

        {onNavigateToLeaveScreen && (
          <Pressable
            onPress={onNavigateToLeaveScreen}
            style={({ pressed }) => [
              styles.linkRow,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.linkText}>Buka Halaman Pengajuan & Status Izin</Text>
            <Ionicons name="chevron-forward" size={14} color={APP_COLORS.primary} />
          </Pressable>
        )}
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
              <Text style={styles.modalTitle}>Form Pengajuan Izin</Text>
              <Pressable
                disabled={submitting}
                onPress={() => setModalVisible(false)}
                style={styles.closeModalBtn}>
                <Ionicons name="close" size={20} color={APP_COLORS.neutral500} />
              </Pressable>
            </View>

            {courseName ? (
              <View style={styles.sessionSummaryPill}>
                <Ionicons name="book-outline" size={14} color={APP_COLORS.primary} />
                <Text style={styles.sessionSummaryText} numberOfLines={1}>
                  {courseName} {className ? `• ${className}` : ''}
                </Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>Alasan Ketidakhadiran *</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Contoh: Saya sedang sakit demam dan harus istirahat berdasarkan saran dokter..."
              placeholderTextColor={APP_COLORS.neutral400}
              multiline
              numberOfLines={4}
              maxLength={500}
              value={reasonText}
              onChangeText={setReasonText}
              editable={!submitting}
              textAlignVertical="top"
            />
            <Text style={styles.charCountText}>{reasonText.trim().length}/500 karakter</Text>

            <View style={styles.aiNoteBox}>
              <Ionicons name="shield-checkmark-outline" size={16} color={APP_COLORS.primary} />
              <Text style={styles.aiNoteText}>
                Pengajuan izin akan dikirim dengan status MENUNGGU untuk direview dan ditentukan statusnya (Diterima / Ditolak) secara manual oleh Asisten Praktikum.
              </Text>
            </View>

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
    padding: APP_SPACING.md,
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
    fontSize: 13,
    color: APP_COLORS.textSecondary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: APP_SPACING.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: APP_COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_SPACING.sm,
  },
  titleTextCol: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
  },
  cardSubtitle: {
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  reasonBox: {
    marginTop: APP_SPACING.md,
    padding: APP_SPACING.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: APP_COLORS.textSecondary,
    marginBottom: 2,
  },
  reasonValue: {
    fontSize: 13,
    color: APP_COLORS.navyHeading,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  badgeRow: {
    marginTop: APP_SPACING.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusExplanationBox: {
    marginTop: APP_SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  statusExplanationText: {
    flex: 1,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    lineHeight: 17,
  },
  actionRow: {
    marginTop: APP_SPACING.md,
  },
  linkRow: {
    marginTop: APP_SPACING.sm,
    paddingTop: APP_SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    color: APP_COLORS.primary,
  },
  pressed: {
    opacity: 0.75,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: APP_SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.xl,
    padding: APP_SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: APP_SPACING.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
  },
  closeModalBtn: {
    padding: 4,
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
    fontSize: 12,
    fontWeight: '600',
    color: APP_COLORS.primary,
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: APP_COLORS.navyHeading,
    marginBottom: 6,
  },
  textArea: {
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: 10,
    padding: APP_SPACING.sm,
    minHeight: 96,
    fontSize: 13,
    color: APP_COLORS.navyHeading,
    backgroundColor: '#F8FAFC',
  },
  charCountText: {
    fontSize: 11,
    color: APP_COLORS.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  aiNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: APP_COLORS.softBlue,
    padding: APP_SPACING.sm,
    borderRadius: 8,
    marginTop: APP_SPACING.sm,
    marginBottom: APP_SPACING.md,
  },
  aiNoteText: {
    flex: 1,
    fontSize: 11,
    color: APP_COLORS.textSecondary,
    lineHeight: 16,
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
