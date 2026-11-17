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
import { APP_COLORS, APP_SPACING } from '@/constants/theme';

export interface AppHeaderProps {
  title?: string;
  onBack?: () => void;
  onNotificationPress?: () => void;
  hasUnreadNotifications?: boolean;
  rightAction?: React.ReactNode;
  subtitle?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title = 'PPK',
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
        {/* Left: Back button or Brand Pill */}
        <View style={styles.leftContainer}>
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
              <Ionicons name="chevron-back" size={20} color="#0F172A" />
            </Pressable>
          ) : (
            <View style={styles.brandBadge}>
              <Ionicons name="layers" size={18} color="#4F46E5" />
            </View>
          )}
        </View>

        {/* Center: Title & Optional Subtitle */}
        <View style={styles.centerContainer}>
          <Text style={styles.titleText} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitleText} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Right: Notification bell or custom action */}
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
              <Ionicons name="notifications-outline" size={20} color="#0F172A" />
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
    backgroundColor: '#F6F7FB',
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
  },
  leftContainer: {
    width: 46,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  brandBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: APP_SPACING.sm,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  rightContainer: {
    width: 46,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  circleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pressed: {
    opacity: 0.72,
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F43F5E',
    borderWidth: 1.5,
    borderColor: APP_COLORS.white,
  },
  placeholder: {
    width: 42,
    height: 42,
  },
});

export default AppHeader;
