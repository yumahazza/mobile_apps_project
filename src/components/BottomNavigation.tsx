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
import { APP_COLORS } from '@/constants/theme';
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
  // Pastikan jarak bawah selalu aman dari navigation bar bawaan Android (3-button maupun gesture nav)
  const bottomClearance = Math.max(
    insets.bottom,
    Platform.OS === 'android' ? 24 : 12,
  );

  const assistantTabs: TabItem[] = [
    {
      key: 'AssistantHome',
      label: 'Beranda',
      iconName: 'grid-outline',
      activeIconName: 'grid',
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
        { paddingBottom: bottomClearance + 6 },
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
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              style={({ pressed }) => [
                styles.tabButton,
                isActive && styles.tabButtonActive,
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
                  color={isActive ? '#0F172A' : '#CBD5E1'}
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
    paddingHorizontal: 18,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  floatingDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#181824',
    borderRadius: 34,
    paddingVertical: 7,
    paddingHorizontal: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: 26,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  iconCircleActive: {
    backgroundColor: '#A5F3FC',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 3,
    letterSpacing: 0.2,
  },
  activeTabLabel: {
    color: APP_COLORS.white,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
});

export default BottomNavigation;
