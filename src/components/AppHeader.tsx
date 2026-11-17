import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { APP_COLORS, APP_FONTS, APP_SPACING } from '@/constants/theme';

export interface AppHeaderProps {
  title?: string;
  onBack?: () => void;
  onNotificationPress?: () => void;
  hasUnreadNotifications?: boolean;
  rightAction?: React.ReactNode;
  subtitle?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title = '',
  onBack,
  onNotificationPress,
  hasUnreadNotifications = true,
  rightAction,
  subtitle,
}) => {
  return (
    <View style={styles.headerWrapper}>
      <StatusBar style="dark" />
      <View style={styles.headerContent}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            style={({ pressed }) => [
              styles.circleButton,
              pressed && styles.pressed,
            ]}>
            <Ionicons name="chevron-back" size={20} color={APP_COLORS.inkPrimary} />
          </Pressable>
        ) : null}

        <View
          style={[
            styles.titleContainer,
            !onBack && styles.titleContainerFlush,
          ]}>
          {title ? (
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={styles.subtitleText} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.rightContainer}>
          {rightAction ? (
            rightAction
          ) : onNotificationPress ? (
            <Pressable
              onPress={onNotificationPress}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Notifikasi"
              style={({ pressed }) => [
                styles.circleButton,
                pressed && styles.pressed,
              ]}>
              <Ionicons
                name="notifications-outline"
                size={20}
                color={APP_COLORS.inkPrimary}
              />
              {hasUnreadNotifications && <View style={styles.notificationDot} />}
            </Pressable>
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerWrapper: {
    backgroundColor: APP_COLORS.background,
    width: '100%',
    paddingTop: Platform.OS === 'ios' ? 6 : 10,
    paddingBottom: 10,
    paddingHorizontal: APP_SPACING.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    gap: APP_SPACING.md,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleContainerFlush: {
    paddingLeft: 2,
  },
  titleText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
    color: APP_COLORS.inkPrimary,
    letterSpacing: -0.2,
  },
  subtitleText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: APP_COLORS.textSecondary,
    marginTop: 1,
  },
  rightContainer: {
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  pressed: {
    opacity: 0.72,
  },
  notificationDot: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: APP_COLORS.danger,
    borderWidth: 1.5,
    borderColor: APP_COLORS.white,
  },
  placeholder: {
    width: 44,
    height: 44,
  },
});

export default AppHeader;
