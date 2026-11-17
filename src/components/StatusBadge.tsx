/**
 * StatusBadge Component
 * Reusable badge for session, attendance, and leave request statuses.
 */

import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { SessionStatus } from '@/data/schedules';
import { APP_COLORS, APP_FONTS, APP_RADIUS } from '@/constants/theme';

export type BadgeStatus = SessionStatus | 'HADIR' | 'TIDAK_HADIR' | 'INFO';

interface StatusBadgeProps {
  status: BadgeStatus | string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  style,
}) => {
  const normalized = (status || '').toUpperCase();

  let backgroundColor: string = APP_COLORS.neutral100;
  let textColor: string = APP_COLORS.neutral700;
  let iconName: React.ComponentProps<typeof Ionicons>['name'] = 'information-circle-outline';
  let displayLabel = label;

  switch (normalized) {
    case 'DIBUKA':
      backgroundColor = APP_COLORS.openedSoft;
      textColor = APP_COLORS.opened;
      iconName = 'radio-button-on';
      displayLabel = displayLabel || 'DIBUKA';
      break;
    case 'BELUM_DIBUKA':
    case 'BELUM DIBUKA':
      backgroundColor = APP_COLORS.notOpenedSoft;
      textColor = APP_COLORS.notOpened;
      iconName = 'time-outline';
      displayLabel = displayLabel || 'BELUM DIBUKA';
      break;
    case 'SELESAI':
      backgroundColor = APP_COLORS.finishedSoft;
      textColor = APP_COLORS.finished;
      iconName = 'checkmark-circle-outline';
      displayLabel = displayLabel || 'SELESAI';
      break;
    case 'HADIR':
      backgroundColor = APP_COLORS.openedSoft;
      textColor = APP_COLORS.opened;
      iconName = 'checkmark-circle';
      displayLabel = displayLabel || 'Hadir';
      break;
    case 'IZIN':
      backgroundColor = APP_COLORS.warningBg;
      textColor = APP_COLORS.warning;
      iconName = 'time-outline';
      displayLabel = displayLabel || 'Izin';
      break;
    case 'ALFA':
    case 'TIDAK_HADIR':
    case 'TIDAK HADIR':
      backgroundColor = APP_COLORS.errorSoft;
      textColor = APP_COLORS.dangerText;
      iconName = 'close-circle-outline';
      displayLabel = displayLabel || 'Alfa';
      break;
    case 'INFO':
      backgroundColor = APP_COLORS.primary50;
      textColor = APP_COLORS.primary;
      iconName = 'information-circle-outline';
      displayLabel = displayLabel || 'INFO';
      break;
    case 'ERROR':
      backgroundColor = APP_COLORS.errorSoft;
      textColor = APP_COLORS.dangerText;
      iconName = 'alert-circle-outline';
      displayLabel = displayLabel || 'ERROR';
      break;
    case 'MENUNGGU':
      backgroundColor = APP_COLORS.notOpenedSoft;
      textColor = APP_COLORS.notOpened;
      iconName = 'time-outline';
      displayLabel = displayLabel || 'MENUNGGU';
      break;
    case 'DITERIMA':
      backgroundColor = APP_COLORS.openedSoft;
      textColor = APP_COLORS.opened;
      iconName = 'checkmark-circle-outline';
      displayLabel = displayLabel || 'DITERIMA';
      break;
    case 'DITOLAK':
      backgroundColor = APP_COLORS.errorSoft;
      textColor = APP_COLORS.dangerText;
      iconName = 'close-circle-outline';
      displayLabel = displayLabel || 'DITOLAK';
      break;
    default:
      displayLabel = displayLabel || normalized;
      break;
  }

  const sizeStyles = {
    sm: {
      paddingVertical: 4,
      paddingHorizontal: 9,
      iconSize: 12,
      fontSize: 11,
    },
    md: {
      paddingVertical: 5,
      paddingHorizontal: 11,
      iconSize: 14,
      fontSize: 12,
    },
    lg: {
      paddingVertical: 6,
      paddingHorizontal: 13,
      iconSize: 15,
      fontSize: 13,
    },
  }[size];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          paddingVertical: sizeStyles.paddingVertical,
          paddingHorizontal: sizeStyles.paddingHorizontal,
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${displayLabel}`}>
      <Ionicons name={iconName} size={sizeStyles.iconSize} color={textColor} />
      <Text
        style={[
          styles.label,
          {
            color: textColor,
            fontSize: sizeStyles.fontSize,
          },
        ]}>
        {displayLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: APP_RADIUS.pill,
    gap: 5,
  },
  label: {
    fontFamily: APP_FONTS.bold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});

export default StatusBadge;
