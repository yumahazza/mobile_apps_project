/**
 * Lintang — SentimentBadge Component
 * Menampilkan label sentimen AI (Positif, Negatif, Netral, Tidak Terklasifikasi)
 * dengan warna dan ikon yang konsisten dengan tema Sprint 1.
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SentimentLabel } from '@/types/attendance';
import { APP_RADIUS } from '@/constants/theme';

interface SentimentBadgeProps {
  sentiment: SentimentLabel;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const SentimentBadge: React.FC<SentimentBadgeProps> = ({
  sentiment,
  size = 'md',
  style,
}) => {
  let backgroundColor = '#F1F5F9';
  let textColor = '#475569';
  let iconName: React.ComponentProps<typeof Ionicons>['name'] = 'chatbubble-ellipses-outline';

  switch (sentiment) {
    case 'Positif':
      backgroundColor = '#DCFCE7';
      textColor = '#16A34A';
      iconName = 'happy-outline';
      break;
    case 'Negatif':
      backgroundColor = '#FEE2E2';
      textColor = '#DC2626';
      iconName = 'sad-outline';
      break;
    case 'Netral':
      backgroundColor = '#E0F2FE';
      textColor = '#0284C7';
      iconName = 'remove-circle-outline';
      break;
    case 'Tidak Terklasifikasi':
    default:
      backgroundColor = '#FEF3C7';
      textColor = '#D97706';
      iconName = 'help-circle-outline';
      break;
  }

  const isSmall = size === 'sm';

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
        {sentiment}
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
    letterSpacing: 0.3,
  },
});

export default SentimentBadge;
