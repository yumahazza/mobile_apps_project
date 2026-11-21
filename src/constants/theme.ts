/**
 * Design tokens and theme definitions aligned with DESIGN_ANTI_AI_SLOP_GUIDELINES.md
 * Palette source: assets/palette/image 12.png (MP067) + WCAG AA semantic status tokens.
 * Font family: Sora (@expo-google-fonts/sora).
 */

import '@/global.css';

import { Platform } from 'react-native';

export const APP_FONTS = {
  regular: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semiBold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
  extraBold: 'Sora_800ExtraBold',
} as const;

export const Colors = {
  light: {
    text: '#17184B',
    background: '#F0EEE9',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#D3DDE7',
    textSecondary: '#4A5073',
  },
  dark: {
    text: '#F0EEE9',
    background: '#17184B',
    backgroundElement: '#273287',
    backgroundSelected: '#3441A1',
    textSecondary: '#D3DDE7',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: APP_FONTS.regular,
    serif: 'ui-serif',
    rounded: APP_FONTS.medium,
    mono: 'ui-monospace',
  },
  default: {
    sans: APP_FONTS.regular,
    serif: 'serif',
    rounded: APP_FONTS.medium,
    mono: 'monospace',
  },
  web: {
    sans: 'Sora_400Regular, Sora, ui-sans-serif, system-ui, sans-serif',
    serif: 'var(--font-serif)',
    rounded: 'Sora_500Medium, Sora, sans-serif',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const APP_COLORS = {
  // Core Palette 
  cloudDancer: '#F0EEE9',
  tetsuKon: '#17184B',
  intergalactic: '#273287',
  durantaYellow: '#D8E63C',
  nordicBreeze: '#D3DDE7',
  lightViolet: '#D6B4FC',

  // Navbar Active Tosca & Dock
  navbarDock: '#17184B',
  navbarTosca: '#5EEAD4',
  navbarInactive: '#D3DDE7',

  // Brand & Primary Aliases
  deepNavy: '#17184B',
  accentBlue: '#273287',
  lightBlue: '#C3CFDC',
  softBlue: '#E8EDF3',

  primary: '#273287',
  primaryHover: '#1E266D',
  deepBlue: '#17184B',
  accent: '#D8E63C',
  primary500: '#273287',
  primary100: '#D3DDE7',
  primary50: '#E8EDF3',

  // Status (WCAG AA contrast >= 4.5:1)
  opened: '#166534',
  openedSoft: '#DCFCE7',
  notOpened: '#92400E',
  notOpenedSoft: '#FEF3C7',
  finished: '#4A5073',
  finishedSoft: '#E2E8F0',
  danger: '#DC2626',
  dangerText: '#B91C1C',
  dangerSoft: '#FEE2E2',
  error: '#DC2626',
  errorSoft: '#FEE2E2',
  info: '#273287',
  infoSoft: '#E8EDF3',
  infoBorder: '#C3CFDC',

  // Neutrals & Surfaces
  neutral950: '#17184B',
  neutral700: '#353A63',
  neutral500: '#4A5073',
  neutral400: '#646B8F',
  neutral300: '#CBD5E1',
  neutral200: '#DCE2EA',
  neutral100: '#EAE6DF',
  neutral50: '#F7F5F0',
  white: '#FFFFFF',

  // Semantic Aliases
  navyHeading: '#17184B',
  inkPrimary: '#17184B',
  background: '#F0EEE9',
  surface: '#FFFFFF',
  surfaceSubtle: '#F7F5F0',
  surfaceSecondary: '#D3DDE7',
  surfaceAlternate: '#D6B4FC',
  border: '#CBD5E1',
  divider: '#E2DFD9',
  textPrimary: '#17184B',
  textSecondary: '#4A5073',
  textMuted: '#5C6384',
  success: '#166534',
  successBg: '#DCFCE7',
  warning: '#92400E',
  warningBg: '#FEF3C7',
  completed: '#4A5073',
  completedBg: '#E2E8F0',
} as const;

export const APP_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const APP_RADIUS = {
  sm: 8,
  md: 12,
  card: 16,
  lg: 16,
  hero: 20,
  xl: 20,
  modal: 20,
  pill: 999,
} as const;

export const APP_TYPOGRAPHY = {
  screenTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 22,
    color: APP_COLORS.inkPrimary,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  heroTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 20,
    color: APP_COLORS.durantaYellow,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  pageTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 20,
    color: APP_COLORS.inkPrimary,
    lineHeight: 26,
  },
  sectionTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 16,
    color: APP_COLORS.inkPrimary,
    lineHeight: 22,
  },
  cardTitle: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 15,
    color: APP_COLORS.inkPrimary,
    lineHeight: 21,
  },
  body: {
    fontFamily: APP_FONTS.regular,
    fontSize: 14,
    color: APP_COLORS.textPrimary,
    lineHeight: 20,
  },
  bodyMedium: {
    fontFamily: APP_FONTS.medium,
    fontSize: 14,
    color: APP_COLORS.textPrimary,
    lineHeight: 20,
  },
  bodySecondary: {
    fontFamily: APP_FONTS.regular,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
    lineHeight: 19,
  },
  meta: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    lineHeight: 17,
  },
  caption: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 11,
    color: APP_COLORS.textMuted,
    lineHeight: 15,
  },
  buttonLabel: {
    fontFamily: APP_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
  },
} as const;

export const APP_SHADOWS = {
  card: Platform.select({
    ios: {
      shadowColor: '#17184B',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
    },
    android: {
      elevation: 1,
    },
    web: {
      boxShadow: '0 1px 3px rgba(23, 24, 75, 0.06)',
    },
    default: {},
  }),
  modal: Platform.select({
    ios: {
      shadowColor: '#17184B',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.14,
      shadowRadius: 18,
    },
    android: {
      elevation: 6,
    },
    web: {
      boxShadow: '0 8px 24px rgba(23, 24, 75, 0.14)',
    },
    default: {},
  }),
} as const;
