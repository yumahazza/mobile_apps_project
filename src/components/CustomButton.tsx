/**
 * CustomButton Component
 * Reusable UI button with primary, accent (Duranta Yellow), secondary, danger, outline, and ghost variants.
 */

import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { APP_COLORS, APP_FONTS, APP_RADIUS, APP_SPACING } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'danger' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface CustomButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export const CustomButton: React.FC<CustomButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = true,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  accessibilityLabel,
}) => {
  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    if (disabled) {
      return {
        container: {
          backgroundColor: APP_COLORS.neutral100,
          borderColor: APP_COLORS.border,
          borderWidth: 1,
        },
        text: {
          color: APP_COLORS.textMuted,
        },
      };
    }

    switch (variant) {
      case 'accent':
        return {
          container: {
            backgroundColor: APP_COLORS.durantaYellow,
            borderColor: 'transparent',
          },
          text: {
            color: APP_COLORS.tetsuKon,
          },
        };
      case 'primary':
        return {
          container: {
            backgroundColor: APP_COLORS.primary,
            borderColor: 'transparent',
          },
          text: {
            color: APP_COLORS.white,
          },
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: APP_COLORS.nordicBreeze,
            borderColor: 'transparent',
          },
          text: {
            color: APP_COLORS.tetsuKon,
          },
        };
      case 'danger':
        return {
          container: {
            backgroundColor: APP_COLORS.danger,
            borderColor: 'transparent',
          },
          text: {
            color: APP_COLORS.white,
          },
        };
      case 'outline':
        return {
          container: {
            backgroundColor: APP_COLORS.white,
            borderColor: APP_COLORS.border,
            borderWidth: 1,
          },
          text: {
            color: APP_COLORS.tetsuKon,
          },
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
            borderColor: 'transparent',
          },
          text: {
            color: APP_COLORS.primary,
          },
        };
      default:
        return {
          container: {
            backgroundColor: APP_COLORS.primary,
            borderColor: 'transparent',
          },
          text: {
            color: APP_COLORS.white,
          },
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            minHeight: 38,
            paddingVertical: 8,
            paddingHorizontal: APP_SPACING.md,
            borderRadius: APP_RADIUS.md,
          },
          text: {
            fontFamily: APP_FONTS.semiBold,
            fontSize: 13,
            lineHeight: 18,
          },
        };
      case 'lg':
        return {
          container: {
            minHeight: 50,
            paddingVertical: 12,
            paddingHorizontal: APP_SPACING.xl,
            borderRadius: APP_RADIUS.lg,
          },
          text: {
            fontFamily: APP_FONTS.bold,
            fontSize: 15,
            lineHeight: 20,
          },
        };
      case 'md':
      default:
        return {
          container: {
            minHeight: 46,
            paddingVertical: 11,
            paddingHorizontal: APP_SPACING.lg,
            borderRadius: APP_RADIUS.md,
          },
          text: {
            fontFamily: APP_FONTS.bold,
            fontSize: 14,
            lineHeight: 19,
          },
        };
    }
  };

  const variantStyle = getVariantStyles();
  const sizeStyle = getSizeStyles();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      hitSlop={size === 'sm' ? 4 : 0}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.baseContainer,
        variantStyle.container,
        sizeStyle.container,
        fullWidth ? styles.fullWidth : styles.compactWidth,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyle.text.color}
        />
      ) : (
        <View style={styles.contentRow}>
          {leftIcon && <View style={styles.iconMargin}>{leftIcon}</View>}
          <Text
            style={[
              styles.baseText,
              variantStyle.text,
              sizeStyle.text,
              textStyle,
            ]}
            numberOfLines={1}>
            {title}
          </Text>
          {rightIcon && <View style={styles.rightIconMargin}>{rightIcon}</View>}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  baseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  fullWidth: {
    width: '100%',
  },
  compactWidth: {
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.82,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  baseText: {
    textAlign: 'center',
    flexShrink: 1,
  },
  iconMargin: {
    marginRight: 6,
  },
  rightIconMargin: {
    marginLeft: 6,
  },
});

export default CustomButton;
