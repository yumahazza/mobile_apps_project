/**
 * Fritz — LeaveClassificationBadge Component (Sprint 2)
 * Menampilkan badge hasil klasifikasi AI pada pengajuan izin praktikan
 * ('Sakit', 'Urusan Keluarga', 'Akademik/Lomba', 'Kendala Teknis', 'Alasan Kurang Kuat',
 * atau 'AI Tidak Merespon / Perlu Cek Manual') beserta tingkat urgensinya.
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LeaveAIStatus, LeaveUrgencyLevel } from '@/types/leaveRequest';
import { APP_RADIUS } from '@/constants/theme';

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

  let backgroundColor = '#F1F5F9';
  let textColor = '#475569';
  let iconName: React.ComponentProps<typeof Ionicons>['name'] = 'bulb-outline';

  if (aiStatus === 'FALLBACK' || clean.includes('tidak merespon') || clean.includes('manual')) {
    backgroundColor = '#FEF3C7';
    textColor = '#D97706';
    iconName = 'warning-outline';
  } else if (clean.includes('sakit')) {
    backgroundColor = '#FCE7F3';
    textColor = '#BE185D';
    iconName = 'medkit-outline';
  } else if (clean.includes('keluarga')) {
    backgroundColor = '#EDE9FE';
    textColor = '#6D28D9';
    iconName = 'people-outline';
  } else if (clean.includes('akademik') || clean.includes('lomba')) {
    backgroundColor = '#DBEAFE';
    textColor = '#1D4ED8';
    iconName = 'school-outline';
  } else if (clean.includes('teknis')) {
    backgroundColor = '#E0F2FE';
    textColor = '#0369A1';
    iconName = 'construct-outline';
  } else if (clean.includes('kurang kuat')) {
    backgroundColor = '#FEE2E2';
    textColor = '#DC2626';
    iconName = 'alert-circle-outline';
  } else {
    backgroundColor = '#E0E7FF';
    textColor = '#4338CA';
    iconName = 'bulb-outline';
  }

  const isSmall = size === 'sm';
  const displayLabel =
    urgency && urgency !== 'Perlu Cek Manual' && aiStatus === 'SUCCESS'
      ? `AI: ${classification} (${urgency})`
      : `AI: ${classification}`;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          paddingVertical: isSmall ? 3 : 5,
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
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default LeaveClassificationBadge;
