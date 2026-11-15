/**
 * Lintang — FeedbackSection Component
 * SRS-STU-004: Form dan tampilan pesan/kesan praktikan setelah sesi selesai
 * SRS-AI-001: Menampilkan badge sentimen hasil analisis AI
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { CustomButton } from '@/components/CustomButton';
import { SentimentBadge } from '@/components/SentimentBadge';
import { useStudentFeedback } from '@/hooks/useRealtimeFeedback';
import { submitPracticumFeedback } from '@/services/feedbackSentimentService';
import {
  APP_COLORS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

interface FeedbackSectionProps {
  scheduleId: string;
  isSessionFinished: boolean;
  studentId: string;
  studentName: string;
}

export const FeedbackSection: React.FC<FeedbackSectionProps> = ({
  scheduleId,
  isSessionFinished,
  studentId,
  studentName,
}) => {
  const { feedback, loading: feedbackLoading } = useStudentFeedback(
    scheduleId,
    studentId,
  );

  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = commentText.trim();
    if (!trimmed) {
      Alert.alert('Validasi', 'Silakan ketikkan pesan atau kesan Anda terlebih dahulu.');
      return;
    }
    if (trimmed.length < 5) {
      Alert.alert('Validasi', 'Pesan & kesan minimal 5 karakter.');
      return;
    }
    if (trimmed.length > 500) {
      Alert.alert('Validasi', 'Pesan & kesan maksimal 500 karakter.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await submitPracticumFeedback({
        scheduleId,
        studentId,
        studentName,
        comment: trimmed,
      });
      setCommentText('');
      Alert.alert(
        'Pesan & Kesan Terkirim',
        `Komentar berhasil disimpan ke Cloud Firestore dengan sentimen: "${res.sentiment}".`,
      );
    } catch (err) {
      Alert.alert(
        'Gagal Mengirim',
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat mengirim pesan & kesan.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSessionFinished) {
    return (
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.iconBox}>
            <Ionicons name="chatbubbles-outline" size={18} color={APP_COLORS.neutral500} />
          </View>
          <View style={styles.titleCol}>
            <Text style={styles.cardTitle}>Pesan & Kesan Praktikum</Text>
            <Text style={styles.cardSubtitle}>
              Form evaluasi akan dibuka setelah asisten menutup sesi praktikum ini (status SELESAI).
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  if (feedbackLoading) {
    return (
      <Card style={styles.card}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={APP_COLORS.primary} />
          <Text style={styles.loadingText}>Memeriksa status pesan & kesan...</Text>
        </View>
      </Card>
    );
  }

  if (feedback) {
    return (
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.iconBoxSuccess}>
            <Ionicons name="checkmark-done" size={18} color={APP_COLORS.opened} />
          </View>
          <View style={styles.titleCol}>
            <Text style={styles.cardTitle}>Pesan & Kesan Anda</Text>
            <Text style={styles.cardSubtitle}>
              Telah tersimpan di Cloud Firestore • {feedback.createdAt || 'Tercatat'}
            </Text>
          </View>
          <SentimentBadge sentiment={feedback.sentiment} size="sm" />
        </View>

        <View style={styles.feedbackDisplayBox}>
          <Text style={styles.feedbackDisplayText}>"{feedback.comment}"</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="sparkles" size={14} color={APP_COLORS.primary} />
          <Text style={styles.sentimentInfoText}>
            Klasifikasi Sentimen AI: <Text style={styles.boldText}>{feedback.sentiment}</Text>
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconBoxPrimary}>
          <Ionicons name="chatbubbles" size={18} color={APP_COLORS.primary} />
        </View>
        <View style={styles.titleCol}>
          <Text style={styles.cardTitle}>Pesan & Kesan Praktikum</Text>
          <Text style={styles.cardSubtitle}>
            Sesi telah selesai! Berikan masukan atau evaluasi mengenai sesi ini.
          </Text>
        </View>
      </View>

      <TextInput
        style={styles.textInput}
        placeholder="Tuliskan pengalaman, kesan, atau kritik membangun..."
        placeholderTextColor={APP_COLORS.neutral400}
        value={commentText}
        onChangeText={setCommentText}
        multiline
        numberOfLines={3}
        maxLength={500}
        editable={!submitting}
      />

      <View style={styles.footerRow}>
        <Text style={styles.charCountText}>
          {commentText.length}/500 karakter
        </Text>
        <CustomButton
          title={submitting ? 'Mengirim...' : 'Kirim Ulasan'}
          variant="primary"
          size="sm"
          disabled={submitting || commentText.trim().length === 0}
          onPress={handleSubmit}
          leftIcon={
            submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={14} color="#FFFFFF" />
            )
          }
        />
      </View>
    </Card>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: APP_SPACING.sm,
    marginBottom: APP_SPACING.sm,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: APP_COLORS.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxSuccess: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: APP_COLORS.openedSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxPrimary: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: APP_COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    lineHeight: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: APP_SPACING.sm,
    paddingVertical: APP_SPACING.sm,
  },
  loadingText: {
    fontSize: 13,
    color: APP_COLORS.textSecondary,
  },
  textInput: {
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: APP_RADIUS.md,
    padding: APP_SPACING.md,
    fontSize: 13,
    color: APP_COLORS.navyHeading,
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: '#F8FAFC',
    marginTop: APP_SPACING.xs,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: APP_SPACING.sm,
  },
  charCountText: {
    fontSize: 11,
    color: APP_COLORS.textMuted,
  },
  feedbackDisplayBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: APP_RADIUS.md,
    padding: APP_SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: APP_COLORS.primary,
    marginVertical: APP_SPACING.xs,
  },
  feedbackDisplayText: {
    fontSize: 13,
    color: APP_COLORS.navyHeading,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: APP_SPACING.xs,
  },
  sentimentInfoText: {
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  boldText: {
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
  },
});

export default FeedbackSection;
