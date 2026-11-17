import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { APP_COLORS, APP_FONTS } from '@/constants/theme';
import { UserRole } from '@/data/users';

export interface TabItem {
  key: string;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  activeIconName: keyof typeof Ionicons.glyphMap;
}

interface BottomNavigationProps {
  role: UserRole;
  activeTab: string;
  onTabChange: (tabKey: string) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  role,
  activeTab,
  onTabChange,
}) => {
  const insets = useSafeAreaInsets();
  const bottomClearance = Math.max(
    insets.bottom,
    Platform.OS === 'android' ? 24 : 12,
  );

  const assistantTabs: TabItem[] = [
    {
      key: 'AssistantHome',
      label: 'Beranda',
      iconName: 'home-outline',
      activeIconName: 'home',
    },
    {
      key: 'SessionRecap',
      label: 'Rekap',
      iconName: 'bar-chart-outline',
      activeIconName: 'bar-chart',
    },
    {
      key: 'ScheduleList',
      label: 'Jadwal',
      iconName: 'calendar-outline',
      activeIconName: 'calendar',
    },
    {
      key: 'Profile',
      label: 'Profil',
      iconName: 'person-outline',
      activeIconName: 'person',
    },
  ];

  const studentTabs: TabItem[] = [
    {
      key: 'StudentHome',
      label: 'Beranda',
      iconName: 'home-outline',
      activeIconName: 'home',
    },
    {
      key: 'ScheduleList',
      label: 'Jadwal',
      iconName: 'calendar-outline',
      activeIconName: 'calendar',
    },
    {
      key: 'StudentHistory',
      label: 'Riwayat',
      iconName: 'time-outline',
      activeIconName: 'time',
    },
    {
      key: 'Profile',
      label: 'Profil',
      iconName: 'person-outline',
      activeIconName: 'person',
    },
  ];

  const tabs = role === 'assistant' ? assistantTabs : studentTabs;

  return (
    <View
      style={[
        styles.dockWrapper,
        { paddingBottom: bottomClearance + 4 },
      ]}>
      <View style={styles.floatingDock}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const icon = isActive ? tab.activeIconName : tab.iconName;

          return (
            <Pressable
              key={tab.key}
              onPress={() => onTabChange(tab.key)}
              hitSlop={6}
              android_ripple={{ color: 'transparent' }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              style={({ pressed }) => [
                styles.tabButton,
                pressed && styles.pressed,
              ]}>
              <View
                style={[
                  styles.iconCircle,
                  isActive && styles.iconCircleActive,
                ]}>
                <Ionicons
                  name={icon}
                  size={20}
                  color={
                    isActive
                      ? APP_COLORS.tetsuKon
                      : APP_COLORS.navbarInactive
                  }
                />
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.tabLabel,
                  isActive && styles.activeTabLabel,
                ]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dockWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: APP_COLORS.background,
  },
  floatingDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: APP_COLORS.navbarDock,
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconCircleActive: {
    backgroundColor: APP_COLORS.navbarTosca,
  },
  tabLabel: {
    fontFamily: APP_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: APP_COLORS.navbarInactive,
    marginTop: 3,
  },
  activeTabLabel: {
    fontFamily: APP_FONTS.bold,
    color: APP_COLORS.navbarTosca,
  },
  pressed: {
    opacity: 0.78,
  },
});

export default BottomNavigation;
