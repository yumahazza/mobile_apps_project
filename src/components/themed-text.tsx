import { StyleSheet, Text, type TextProps } from 'react-native';

import { APP_FONTS, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return <Text style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  small: {
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    lineHeight: 19,
  },
  smallBold: {
    fontFamily: APP_FONTS.bold,
    fontSize: 14,
    lineHeight: 20,
  },
  default: {
    fontFamily: APP_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    fontFamily: APP_FONTS.bold,
    fontSize: 24,
    lineHeight: 30,
  },
  subtitle: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  link: {
    fontFamily: APP_FONTS.medium,
    lineHeight: 24,
    fontSize: 14,
  },
  linkPrimary: {
    fontFamily: APP_FONTS.semiBold,
    lineHeight: 24,
    fontSize: 14,
    color: '#273287',
  },
  code: {
    fontFamily: Fonts?.mono,
    fontSize: 12,
  },
});
