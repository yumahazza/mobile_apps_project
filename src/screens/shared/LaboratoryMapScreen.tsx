import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import LaboratoryOSMMap from '@/components/laboratory-map/LaboratoryOSMMap';

import { useApp } from '@/context/AppContext';
import { useFirestoreSchedules } from '@/hooks/useFirestoreSchedules';
import { useLaboratories } from '@/hooks/useLaboratories';
import type { LaboratoryLocation } from '@/services/laboratoryMapService';
import {
  getCurrentMapLocation,
  requestMapLocationPermission,
  watchMapLocation,
} from '@/services/mapLocationAdapter';
import type { DeviceCoordinates } from '@/services/mapLocationAdapter';
import type { PracticumSchedule } from '@/services/practicumScheduleService';
import { BottomNavigation } from '@/components/BottomNavigation';
import type { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
  APP_FONTS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

interface LaboratoryMapScreenProps {
  navigation: NavigationProp;
}

type MapSchedule = PracticumSchedule & { laboratoryId?: string };

const INDONESIA_CENTER: [number, number] = [-2.5, 118];

function normalize(value: string): string {
  return value
    .toLocaleLowerCase('id-ID')
    .replace(/laboratorium|lab\.?/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function scheduleBelongsToLaboratory(
  schedule: MapSchedule,
  laboratory: LaboratoryLocation,
): boolean {
  if (schedule.laboratoryId) {
    return schedule.laboratoryId === laboratory.id;
  }

  // Backward-compatible matching for Sprint 2 schedules, whose shared
  // contract stores the room as text and does not yet have laboratoryId.
  const room = normalize(schedule.room);
  const candidates = [
    laboratory.name,
    laboratory.building,
    `${laboratory.building}${laboratory.floor}`,
  ]
    .filter(Boolean)
    .map(normalize);

  return candidates.some(
    candidate => candidate.length > 0 && (room === candidate || room.includes(candidate)),
  );
}

function parseScheduleStart(schedule: PracticumSchedule): Date | null {
  const dateMatch = schedule.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = schedule.time.match(/^([01]\d|2[0-3]):([0-5]\d)/);
  if (!dateMatch || !timeMatch) return null;

  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatLocation(laboratory: LaboratoryLocation): string {
  return [laboratory.building, laboratory.floor ? `Lantai ${laboratory.floor}` : '']
    .filter(Boolean)
    .join(' · ');
}

export const LaboratoryMapScreen: React.FC<LaboratoryMapScreenProps> = ({
  navigation,
}) => {
  const { activeUser, activeRole } = useApp();
  const { schedules, loading: schedulesLoading, error: schedulesError } =
    useFirestoreSchedules(activeUser.id, activeRole);
  const {
    laboratories,
    loading: laboratoriesLoading,
    error: laboratoriesError,
  } = useLaboratories();

  const [selectedLaboratory, setSelectedLaboratory] =
    useState<LaboratoryLocation | null>(null);
  const [deviceLocation, setDeviceLocation] =
    useState<DeviceCoordinates | null>(null);
  const [locationMessage, setLocationMessage] = useState(
    'Memeriksa izin lokasi perangkat...',
  );
  const [locationLoading, setLocationLoading] = useState(true);

  const startLocationTracking = useCallback(async () => {
    setLocationLoading(true);
    setLocationMessage('Meminta izin lokasi perangkat...');

    try {
      const granted = await requestMapLocationPermission();
      if (!granted) {
        setDeviceLocation(null);
        setLocationMessage(
          'Izin lokasi ditolak. Aktifkan izin lokasi agar posisi Anda tampil di peta.',
        );
        return;
      }

      const current = await getCurrentMapLocation();
      setDeviceLocation(current);
      setLocationMessage('Lokasi perangkat berhasil diperbarui.');

      const subscription = await watchMapLocation(coordinates => {
        setDeviceLocation(coordinates);
      });

      return subscription;
    } catch (error) {
      setLocationMessage(
        error instanceof Error
          ? error.message
          : 'Lokasi belum tersedia. Pastikan GPS perangkat aktif.',
      );
    } finally {
      setLocationLoading(false);
    }
    return undefined;
  }, []);

  useEffect(() => {
    let active = true;
    let subscription: { remove: () => void } | undefined;

    void startLocationTracking().then(result => {
      if (!active) {
        result?.remove();
        return;
      }
      subscription = result;
    });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [startLocationTracking]);

  useEffect(() => {
    if (!selectedLaboratory && laboratories.length > 0) {
      setSelectedLaboratory(laboratories[0]);
    }
    if (
      selectedLaboratory &&
      !laboratories.some(item => item.id === selectedLaboratory.id)
    ) {
      setSelectedLaboratory(laboratories[0] ?? null);
    }
  }, [laboratories, selectedLaboratory]);

  const selectedSchedules = useMemo(() => {
    if (!selectedLaboratory) return [];

    const now = new Date();
    return (schedules as MapSchedule[])
      .filter(schedule => scheduleBelongsToLaboratory(schedule, selectedLaboratory))
      .map(schedule => ({
        schedule,
        start: parseScheduleStart(schedule),
      }))
      .sort((a, b) => {
        if (!a.start) return 1;
        if (!b.start) return -1;
        return a.start.getTime() - b.start.getTime();
      })
      .filter(item => item.start && item.start.getTime() >= now.getTime() - 3 * 60 * 60 * 1000);
  }, [schedules, selectedLaboratory]);

  const currentActivity = selectedSchedules.find(
    item => item.schedule.status === 'DIBUKA',
  );
  const nextActivity = selectedSchedules.find(
    item =>
      item.schedule.status === 'BELUM_DIBUKA' &&
      Boolean(item.start && item.start.getTime() >= Date.now()) &&
      (!currentActivity || item.schedule.id !== currentActivity.schedule.id),
  );

  const handleSelectLaboratory = (laboratory: LaboratoryLocation) => {
    setSelectedLaboratory(laboratory);
  };

  const renderActivity = (
    label: string,
    schedule: PracticumSchedule | undefined,
    icon: keyof typeof Ionicons.glyphMap,
    emptyMessage: string,
  ) => (
    <View style={styles.activityRow}>
      <View style={styles.activityIcon}>
        <Ionicons name={icon} size={18} color={APP_COLORS.primary} />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityLabel}>{label}</Text>
        {schedule ? (
          <>
            <Text style={styles.activityTitle}>{schedule.courseName}</Text>
            <Text style={styles.activityMeta}>
              {schedule.className} · {schedule.date} · {schedule.time}
            </Text>
            <Text style={styles.activityStatus}>
              {schedule.status.replace(/_/g, ' ')}
            </Text>
          </>
        ) : (
          <Text style={styles.emptyActivity}>{emptyMessage}</Text>
        )}
      </View>
    </View>
  );

  const mapCenter = useMemo<[number, number]>(() => {
    if (deviceLocation) {
      return [deviceLocation.latitude, deviceLocation.longitude];
    }
    if (laboratories[0]) {
      return [laboratories[0].latitude, laboratories[0].longitude];
    }
    return INDONESIA_CENTER;
  }, [deviceLocation, laboratories]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Peta Laboratorium</Text>
          <Text style={styles.subtitle}>
            Lokasi dan aktivitas praktikum secara real-time
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Perbarui lokasi"
          onPress={() => {
            void startLocationTracking().then(result => result?.remove());
          }}
          style={styles.locationButton}>
          {locationLoading ? (
            <ActivityIndicator color={APP_COLORS.primary} size="small" />
          ) : (
            <Ionicons name="locate-outline" size={21} color={APP_COLORS.primary} />
          )}
        </Pressable>
      </View>

      <View style={styles.mapContainer}>
        <LaboratoryOSMMap
          laboratories={laboratories}
          selectedLaboratoryId={selectedLaboratory?.id ?? null}
          deviceLocation={deviceLocation}
          initialCenter={mapCenter}
          onSelectLaboratory={handleSelectLaboratory}
        />
        <View style={styles.mapLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#D97706' }]} />
            <Text style={styles.legendText}>Laboratorium</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
            <Text style={styles.legendText}>Lokasi Anda</Text>
          </View>
        </View>
      </View>

      <View style={styles.infoPanel}>
        <View style={styles.panelHeading}>
          <View style={styles.panelHeadingText}>
            <Text style={styles.panelTitle}>
              {selectedLaboratory?.name ?? 'Informasi Laboratorium'}
            </Text>
            <Text style={styles.panelSubtitle}>
              {selectedLaboratory
                ? formatLocation(selectedLaboratory) || 'Lokasi laboratorium'
                : 'Pilih marker laboratorium pada peta'}
            </Text>
          </View>
          {selectedLaboratory ? (
            <View style={styles.radiusBadge}>
              <Text style={styles.radiusText}>
                {selectedLaboratory.radius > 0
                  ? `Radius ${selectedLaboratory.radius} m`
                  : 'Radius belum diatur'}
              </Text>
            </View>
          ) : null}
        </View>

        {laboratoriesLoading || schedulesLoading ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color={APP_COLORS.primary} />
            <Text style={styles.emptyActivity}>Memuat informasi laboratorium...</Text>
          </View>
        ) : laboratoriesError || schedulesError ? (
          <Text style={styles.errorText}>
            {laboratoriesError || schedulesError}
          </Text>
        ) : !selectedLaboratory ? (
          <Text style={styles.emptyActivity}>
            Belum ada data laboratorium. Data akan tampil setelah koleksi laboratories diisi.
          </Text>
        ) : (
          <ScrollView
            style={styles.activityList}
            contentContainerStyle={styles.activityListContent}
            showsVerticalScrollIndicator={false}>
            {renderActivity(
              'SEDANG BERLANGSUNG',
              currentActivity?.schedule,
              'radio-button-on-outline',
              'Tidak ada praktikum yang sedang berlangsung.',
            )}
            <View style={styles.separator} />
            {renderActivity(
              'PRAKTIKUM BERIKUTNYA',
              nextActivity?.schedule,
              'calendar-outline',
              'Belum ada praktikum berikutnya.',
            )}
          </ScrollView>
        )}
        <Text style={styles.locationHint}>
          <Ionicons name="location-outline" size={12} color={APP_COLORS.textSecondary} />{' '}
          {locationMessage}
        </Text>
      </View>

      <BottomNavigation
        role={activeRole}
        activeTab="LaboratoryMap"
        onTabChange={tabKey => navigation.navigate(tabKey)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  header: {
    paddingHorizontal: APP_SPACING.lg,
    paddingTop: APP_SPACING.md,
    paddingBottom: APP_SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: APP_COLORS.primary,
    fontFamily: APP_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  title: {
    color: APP_COLORS.inkPrimary,
    fontFamily: APP_FONTS.bold,
    fontSize: 21,
    marginTop: 2,
  },
  subtitle: {
    color: APP_COLORS.textSecondary,
    fontFamily: APP_FONTS.regular,
    fontSize: 11,
    marginTop: 3,
  },
  locationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: APP_COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  mapContainer: {
    flex: 1,
    minHeight: 220,
    marginHorizontal: APP_SPACING.md,
    borderRadius: APP_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  mapLegend: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendText: {
    color: APP_COLORS.inkPrimary,
    fontFamily: APP_FONTS.medium,
    fontSize: 10,
  },
  infoPanel: {
    backgroundColor: APP_COLORS.white,
    borderTopLeftRadius: APP_RADIUS.lg,
    borderTopRightRadius: APP_RADIUS.lg,
    marginTop: APP_SPACING.sm,
    paddingHorizontal: APP_SPACING.lg,
    paddingTop: APP_SPACING.md,
    paddingBottom: APP_SPACING.sm,
    maxHeight: 260,
    minHeight: 190,
  },
  panelHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: APP_SPACING.sm,
  },
  panelHeadingText: {
    flex: 1,
  },
  panelTitle: {
    fontFamily: APP_FONTS.bold,
    color: APP_COLORS.inkPrimary,
    fontSize: 15,
  },
  panelSubtitle: {
    fontFamily: APP_FONTS.regular,
    color: APP_COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  radiusBadge: {
    borderRadius: APP_RADIUS.pill,
    backgroundColor: APP_COLORS.softBlue,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  radiusText: {
    fontFamily: APP_FONTS.semiBold,
    color: APP_COLORS.primary,
    fontSize: 9,
  },
  activityList: {
    flexGrow: 0,
  },
  activityListContent: {
    paddingBottom: 4,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 5,
  },
  activityIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: APP_COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityLabel: {
    fontFamily: APP_FONTS.bold,
    color: APP_COLORS.textSecondary,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  activityTitle: {
    fontFamily: APP_FONTS.semiBold,
    color: APP_COLORS.inkPrimary,
    fontSize: 12,
    marginTop: 2,
  },
  activityMeta: {
    fontFamily: APP_FONTS.regular,
    color: APP_COLORS.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  activityStatus: {
    fontFamily: APP_FONTS.semiBold,
    color: APP_COLORS.opened,
    fontSize: 9,
    marginTop: 2,
  },
  emptyActivity: {
    fontFamily: APP_FONTS.regular,
    color: APP_COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  separator: {
    height: 1,
    backgroundColor: APP_COLORS.divider,
    marginVertical: 3,
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  errorText: {
    fontFamily: APP_FONTS.regular,
    color: APP_COLORS.dangerText,
    fontSize: 11,
  },
  locationHint: {
    fontFamily: APP_FONTS.regular,
    color: APP_COLORS.textSecondary,
    fontSize: 9,
    marginTop: 5,
  },
});

export default LaboratoryMapScreen;
