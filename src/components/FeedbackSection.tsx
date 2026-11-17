/**
 * FeedbackSection Component
 * Form pesan & kesan praktikan setelah sesi selesai + hasil sentimen AI.
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
  APP_FONTS,
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
      Alert.alert('Validasi', 'Ketikkan pesan atau kesan terlebih dahulu.');
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
        'Ulasan Terkirim',
        `Tersimpan dengan sentimen: "${res.sentiment}".`,
      );
    } catch (err) {
      Alert.alert(
        'Gagal Mengirim',
        err instanceof Error
          ? err.message
          : 'Gagal mengirim pesan & kesan.',
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
            <Ionicons name="chatbubbles-outline" size={18} color={APP_COLORS.textSecondary} />
          </View>
          <View style={styles.titleCol}>
            <Text style={styles.cardTitle}>Pesan & Kesan</Text>
            <Text style={styles.cardSubtitle}>
              Dibuka setelah sesi ditutup asisten.
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
          <Text style={styles.loadingText}>Memuat ulasan...</Text>
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
            <Text style={styles.cardTitle}>Ulasan Anda</Text>
            <Text style={styles.cardSubtitle}>
              {feedback.createdAt || 'Terkirim'}
            </Text>
          </View>
          <SentimentBadge sentiment={feedback.sentiment} size="sm" />
        </View>

        <View style={styles.feedbackDisplayBox}>
          <Text style={styles.feedbackDisplayText}>“{feedback.comment}”</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="sparkles" size={14} color={APP_COLORS.primary} />
          <Text style={styles.sentimentInfoText}>
            Sentimen AI: <Text style={styles.boldText}>{feedback.sentiment}</Text>
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconBoxPrimary}>
          <Ionicons name="chatbubbles-outline" size={18} color={APP_COLORS.primary} />
        </View>
        <View style={styles.titleCol}>
          <Text style={styles.cardTitle}>Pesan & Kesan</Text>
          <Text style={styles.cardSubtitle}>
            Berikan evaluasi singkat untuk sesi ini.
          </Text>
        </View>
      </View>

      <TextInput
        style={styles.textInput}
        placeholder="Tulis kesan atau saran..."
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
          {commentText.length}/500
        </Text>
        <CustomButton
          title={submitting ? 'Mengirim...' : 'Kirim'}
          variant="primary"
          size="sm"
          fullWidth={false}
          disabled={submitting || commentText.trim().length === 0}
          onPress={handleSubmit}
          leftIcon={
            submitting ? (
              <ActivityIndicator size="small" color={APP_COLORS.white} />
            ) : (
              <Ionicons name="send" size={13} color={APP_COLORS.white} />
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
    alignItems: 'center',
    gap: APP_SPACING.sm,
    marginBottom: APP_SPACING.sm,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: APP_COLORS.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxSuccess: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: APP_COLORS.openedSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxPrimary: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: APP_COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 15,
    color: APP_COLORS.inkPrimary,
  },
  cardSubtitle: {
    fontFamily: APP_FONTS.regular,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    lineHeight: 16,
    marginTop: 1,
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
  textInput: {
    fontFamily: APP_FONTS.regular,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: APP_RADIUS.md,
    padding: APP_SPACING.md,
    fontSize: 14,
    lineHeight: 20,
    color: APP_COLORS.inkPrimary,
    minHeight: 84,
    textAlignVertical: 'top',
    backgroundColor: APP_COLORS.surfaceSubtle,
    marginTop: APP_SPACING.xs,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: APP_SPACING.sm,
  },
  charCountText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 11,
    color: APP_COLORS.textMuted,
  },
  feedbackDisplayBox: {
    backgroundColor: APP_COLORS.surfaceSubtle,
    borderRadius: APP_RADIUS.md,
    padding: APP_SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: APP_COLORS.primary,
    marginVertical: APP_SPACING.xs,
  },
  feedbackDisplayText: {
    fontFamily: APP_FONTS.regular,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: APP_SPACING.xs,
  },
  sentimentInfoText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  boldText: {
    fontFamily: APP_FONTS.bold,
    color: APP_COLORS.inkPrimary,
  },
});

export default FeedbackSection;
