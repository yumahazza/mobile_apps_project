
/**
 * Header identitas pengguna berdasarkan akun Firebase yang aktif.
 * Role hanya ditampilkan, bukan digunakan untuk berpindah akun.
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
        size={16}
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
    paddingHorizontal: APP_SPACING.xl,
    paddingVertical: APP_SPACING.md,
    gap: APP_SPACING.md,
    backgroundColor: APP_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.neutral200,
  },

  introduction: {
    flex: 1,
    minWidth: 0,
  },

  greeting: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    color: APP_COLORS.neutral950,
  },

  identity: {
    fontSize: 12,
    lineHeight: 17,
    color: APP_COLORS.neutral500,
    marginTop: 2,
  },

  accountBadge: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: APP_SPACING.md,
    borderWidth: 1,
    borderRadius: APP_RADIUS.pill,
  },

  accountAssistant: {
    backgroundColor: APP_COLORS.primary50,
    borderColor: APP_COLORS.primary100,
  },

  accountStudent: {
    backgroundColor: APP_COLORS.openedSoft,
    borderColor: '#BBF7D0',
  },

  roleText: {
    fontSize: 13,
    fontWeight: '700',
  },

  textAssistant: {
    color: APP_COLORS.primary,
  },

  textStudent: {
    color: APP_COLORS.opened,
  },
});

export default HeaderRolePicker;
