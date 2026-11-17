/**
 * ConfirmModal Component
 * Reusable confirmation modal dialog aligned with DESIGN_ANTI_AI_SLOP_GUIDELINES.md
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import {
  APP_COLORS,
  APP_FONTS,
  APP_RADIUS,
  APP_SPACING,
  APP_SHADOWS,
} from '@/constants/theme';
import { CustomButton, ButtonVariant } from '@/components/CustomButton';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  details?: {
    courseName?: string;
    className?: string;
    time?: string;
    room?: string;
  };
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: ButtonVariant;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  subtitle,
  details,
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  loading = false,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.dialog, APP_SHADOWS.modal]} accessibilityViewIsModal>
              <Text style={styles.title}>{title}</Text>

              {details && (
                <View style={styles.detailsCard}>
                  {details.courseName && (
                    <Text style={styles.detailsTitle}>
                      {details.courseName}
                      {details.className ? ` · ${details.className}` : ''}
                    </Text>
                  )}
                  {details.time && (
                    <Text style={styles.detailsSub}>{details.time}</Text>
                  )}
                  {details.room && (
                    <Text style={styles.detailsSub}>{details.room}</Text>
                  )}
                </View>
              )}

              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

              <View style={styles.actionsRow}>
                <View style={styles.actionBtnWrapper}>
                  <CustomButton
                    title={cancelText}
                    variant="outline"
                    onPress={onCancel}
                    disabled={loading}
                    size="md"
                  />
                </View>
                <View style={styles.actionBtnWrapper}>
                  <CustomButton
                    title={confirmText}
                    variant={confirmVariant}
                    onPress={onConfirm}
                    loading={loading}
                    size="md"
                  />
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 24, 75, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: APP_SPACING.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.modal,
    padding: APP_SPACING.xl,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  title: {
    fontFamily: APP_FONTS.bold,
    fontSize: 18,
    lineHeight: 24,
    color: APP_COLORS.inkPrimary,
    marginBottom: APP_SPACING.xs,
  },
  subtitle: {
    fontFamily: APP_FONTS.regular,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
    lineHeight: 19,
    marginBottom: APP_SPACING.lg,
  },
  detailsCard: {
    backgroundColor: APP_COLORS.surfaceSubtle,
    borderColor: APP_COLORS.border,
    borderWidth: 1,
    borderRadius: APP_RADIUS.md,
    padding: APP_SPACING.md,
    marginVertical: APP_SPACING.sm,
  },
  detailsTitle: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
    marginBottom: 2,
  },
  detailsSub: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: APP_SPACING.sm,
    marginTop: APP_SPACING.xs,
  },
  actionBtnWrapper: {
    flex: 1,
  },
});

export default ConfirmModal;
