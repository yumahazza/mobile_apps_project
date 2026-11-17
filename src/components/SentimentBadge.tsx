/**
 * SentimentBadge Component
 * Menampilkan label sentimen AI (Positif, Negatif, Netral, Tidak Terklasifikasi)
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SentimentLabel } from '@/types/attendance';
import { APP_COLORS, APP_FONTS, APP_RADIUS } from '@/constants/theme';

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
  let backgroundColor: string = APP_COLORS.neutral100;
  let textColor: string = APP_COLORS.textSecondary;
  let iconName: React.ComponentProps<typeof Ionicons>['name'] = 'chatbubble-ellipses-outline';

  switch (sentiment) {
    case 'Positif':
      backgroundColor = APP_COLORS.openedSoft;
      textColor = APP_COLORS.opened;
      iconName = 'happy-outline';
      break;
    case 'Negatif':
      backgroundColor = APP_COLORS.dangerSoft;
      textColor = APP_COLORS.dangerText;
      iconName = 'sad-outline';
      break;
    case 'Netral':
      backgroundColor = APP_COLORS.softBlue;
      textColor = APP_COLORS.primary;
      iconName = 'remove-circle-outline';
      break;
    case 'Tidak Terklasifikasi':
    default:
      backgroundColor = APP_COLORS.notOpenedSoft;
      textColor = APP_COLORS.notOpened;
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
    fontFamily: APP_FONTS.bold,
    letterSpacing: 0.2,
  },
});

export default SentimentBadge;
