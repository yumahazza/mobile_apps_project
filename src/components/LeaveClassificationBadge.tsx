/**
 * LeaveClassificationBadge Component
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LeaveAIStatus, LeaveUrgencyLevel } from '@/types/leaveRequest';
import { APP_COLORS, APP_FONTS, APP_RADIUS } from '@/constants/theme';

interface LeaveClassificationBadgeProps {
  classification: string;
  aiStatus?: LeaveAIStatus;
  urgency?: LeaveUrgencyLevel;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const LeaveClassificationBadge: React.FC<LeaveClassificationBadgeProps> = ({
  classification,
  aiStatus = 'SUCCESS',
  urgency,
  size = 'md',
  style,
}) => {
  const clean = (classification || '').toLowerCase();

  let backgroundColor: string = APP_COLORS.softBlue;
  let textColor: string = APP_COLORS.inkPrimary;
  let iconName: React.ComponentProps<typeof Ionicons>['name'] = 'information-circle-outline';

  if (aiStatus === 'FALLBACK' || clean.includes('tidak merespon') || clean.includes('manual')) {
    backgroundColor = APP_COLORS.notOpenedSoft;
    textColor = APP_COLORS.notOpened;
    iconName = 'warning-outline';
  } else if (clean.includes('sakit')) {
    backgroundColor = '#FCE7F3';
    textColor = '#9D174D';
    iconName = 'medkit-outline';
  } else if (clean.includes('keluarga')) {
    backgroundColor = '#EDE9FE';
    textColor = '#5B21B6';
    iconName = 'people-outline';
  } else if (clean.includes('akademik') || clean.includes('lomba')) {
    backgroundColor = APP_COLORS.nordicBreeze;
    textColor = APP_COLORS.inkPrimary;
    iconName = 'school-outline';
  } else if (clean.includes('teknis')) {
    backgroundColor = APP_COLORS.softBlue;
    textColor = APP_COLORS.primary;
    iconName = 'construct-outline';
  } else if (clean.includes('kurang kuat')) {
    backgroundColor = APP_COLORS.dangerSoft;
    textColor = APP_COLORS.dangerText;
    iconName = 'alert-circle-outline';
  }

  const isSmall = size === 'sm';
  const displayLabel =
    urgency && urgency !== 'Perlu Cek Manual' && aiStatus === 'SUCCESS'
      ? `${classification} (${urgency})`
      : classification;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          paddingVertical: isSmall ? 4 : 5,
          paddingHorizontal: isSmall ? 8 : 10,
        },
        style,
      ]}>
      <Ionicons name={iconName} size={isSmall ? 12 : 14} color={textColor} />
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize: isSmall ? 11 : 12,
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
    borderRadius: APP_RADIUS.pill,
    gap: 5,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: APP_FONTS.semiBold,
  },
});

export default LeaveClassificationBadge;
