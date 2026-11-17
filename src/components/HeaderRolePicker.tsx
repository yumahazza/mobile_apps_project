/**
 * Header identitas pengguna berdasarkan akun Firebase yang aktif.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import {
  APP_COLORS,
  APP_FONTS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

export interface HeaderRolePickerProps {
  compact?: boolean;
  showGreeting?: boolean;
}

export const HeaderRolePicker: React.FC<HeaderRolePickerProps> = ({
  compact = false,
  showGreeting = true,
}) => {
  const { activeUser } = useApp();
  const assistant = activeUser.role === 'assistant';

  const roleBadge = (
    <View
      style={[
        styles.accountBadge,
        assistant ? styles.accountAssistant : styles.accountStudent,
      ]}
      accessibilityLabel={
        assistant ? 'Role Asisten' : 'Role Praktikan'
      }>
      <Ionicons
        name={
          assistant
            ? 'shield-checkmark-outline'
            : 'school-outline'
        }
        size={14}
        color={
          assistant
            ? APP_COLORS.primary
            : APP_COLORS.opened
        }
      />

      <Text
        style={[
          styles.roleText,
          assistant ? styles.textAssistant : styles.textStudent,
        ]}>
        {assistant ? 'Asisten' : 'Praktikan'}
      </Text>
    </View>
  );

  if (compact || !showGreeting) {
    return roleBadge;
  }

  return (
    <View style={styles.header}>
      <View style={styles.introduction}>
        <Text style={styles.greeting} numberOfLines={1}>
          Halo, {activeUser.name.split(' ')[0]}
        </Text>

        <Text style={styles.identity} numberOfLines={1}>
          {assistant
            ? 'Asisten Praktikum'
            : `Praktikan · ${activeUser.nim || '-'}`}
        </Text>
      </View>

      {roleBadge}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: APP_SPACING.lg,
    paddingVertical: APP_SPACING.md,
    gap: APP_SPACING.md,
    backgroundColor: APP_COLORS.background,
  },
  introduction: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontFamily: APP_FONTS.bold,
    fontSize: 18,
    lineHeight: 24,
    color: APP_COLORS.inkPrimary,
  },
  identity: {
    fontFamily: APP_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: APP_COLORS.textSecondary,
    marginTop: 2,
  },
  accountBadge: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: APP_SPACING.md,
    borderWidth: 1,
    borderRadius: APP_RADIUS.pill,
  },
  accountAssistant: {
    backgroundColor: APP_COLORS.softBlue,
    borderColor: APP_COLORS.infoBorder,
  },
  accountStudent: {
    backgroundColor: APP_COLORS.openedSoft,
    borderColor: '#BBF7D0',
  },
  roleText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
  },
  textAssistant: {
    color: APP_COLORS.primary,
  },
  textStudent: {
    color: APP_COLORS.opened,
  },
});

export default HeaderRolePicker;
