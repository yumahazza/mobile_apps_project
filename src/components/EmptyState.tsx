import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  APP_COLORS,
  APP_FONTS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBgColor?: string;
  badge?: string;
  title: string;
  description: string;
  hint?: string;
  actionTitle?: string;
  onActionPress?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  iconName,
  iconColor = APP_COLORS.textSecondary,
  iconBgColor = APP_COLORS.softBlue,
  badge,
  title,
  description,
  hint,
  actionTitle,
  onActionPress,
}) => {
  const resolvedIcon = iconName ?? icon ?? 'file-tray-outline';

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: iconBgColor },
        ]}
      >
        <Ionicons
          name={resolvedIcon}
          size={32}
          color={iconColor}
        />
      </View>

      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}

      <Text style={styles.title}>{title}</Text>

      <Text style={styles.description}>{description}</Text>

      {hint ? (
        <View style={styles.hintContainer}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={APP_COLORS.primary}
          />
          <Text style={styles.hintText}>{hint}</Text>
        </View>
      ) : null}

      {actionTitle && onActionPress ? (
        <Pressable
          onPress={onActionPress}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.actionButtonText}>{actionTitle}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
    padding: APP_SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginVertical: APP_SPACING.sm,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: APP_SPACING.md,
  },
  badge: {
    backgroundColor: APP_COLORS.softBlue,
    paddingHorizontal: APP_SPACING.md,
    paddingVertical: APP_SPACING.xs,
    borderRadius: APP_RADIUS.pill,
    marginBottom: APP_SPACING.sm,
  },
  badgeText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 11,
    color: APP_COLORS.primary,
    textAlign: 'center',
  },
  title: {
    fontFamily: APP_FONTS.bold,
    fontSize: 15,
    color: APP_COLORS.inkPrimary,
    marginBottom: APP_SPACING.xs,
    textAlign: 'center',
  },
  description: {
    fontFamily: APP_FONTS.regular,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 300,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: APP_SPACING.xs,
    width: '100%',
    marginTop: APP_SPACING.md,
    padding: APP_SPACING.md,
    backgroundColor: APP_COLORS.softBlue,
    borderRadius: APP_RADIUS.md,
  },
  hintText: {
    flex: 1,
    fontFamily: APP_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    color: APP_COLORS.textSecondary,
  },
  actionButton: {
    marginTop: APP_SPACING.md,
    minHeight: 42,
    paddingHorizontal: APP_SPACING.lg,
    paddingVertical: APP_SPACING.sm,
    backgroundColor: APP_COLORS.primary,
    borderRadius: APP_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPressed: {
    opacity: 0.78,
  },
  actionButtonText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 13,
    color: APP_COLORS.white,
  },
});

export default EmptyState;
