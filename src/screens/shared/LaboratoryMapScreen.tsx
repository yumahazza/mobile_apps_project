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
  DEFAULT_LABORATORY_RADIUS_METERS,
  MIN_LABORATORY_RADIUS_METERS,
  updateLaboratory,
} from '@/services/laboratoryService';
import { showMessage } from '@/services/dialogService';
import type { PickedCoordinate } from '@/components/laboratory-map/LaboratoryOSMMap.types';
import {
  getCurrentMapLocation,
  watchMapLocation,
} from '@/services/mapLocationAdapter';
import type { DeviceCoordinates } from '@/services/mapLocationAdapter';
import {
  calculateDistanceMeters,
  formatDistanceMeters,
  openDeviceLocationSettings,
} from '@/services/locationService';
import type { LocationServiceError } from '@/types/location';
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
  const [locationError, setLocationError] =
    useState<LocationServiceError | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [deviceFocusToken, setDeviceFocusToken] = useState(0);
  const [watchKey, setWatchKey] = useState(0);
  const [fitAllToken, setFitAllToken] = useState(0);
  const [pickMode, setPickMode] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<PickedCoordinate | null>(null);
  const [savingPosition, setSavingPosition] = useState(false);

  // Pemantauan lokasi berkelanjutan; dibersihkan otomatis saat layar ditutup.
  useEffect(() => {
    setLocationLoading(true);
    const stop = watchMapLocation(
      coordinates => {
        setDeviceLocation(coordinates);
        setLocationError(null);
        setLocationLoading(false);
      },
      error => {
        setLocationError(error);
        setLocationLoading(false);
      },
    );
    return stop;
  }, [watchKey]);

  const refreshLocation = useCallback(async () => {
    setLocationLoading(true);
    const result = await getCurrentMapLocation();
    if (result.ok) {
      setDeviceLocation(result.data);
      setLocationError(null);
      setDeviceFocusToken(value => value + 1);
      // Mulai ulang pemantauan jika sebelumnya gagal (mis. izin baru diberikan).
      if (locationError) setWatchKey(value => value + 1);
    } else {
      setLocationError(result.error);
    }
    setLocationLoading(false);
  }, [locationError]);

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

  const distanceToSelected = useMemo(() => {
    if (!deviceLocation || !selectedLaboratory) return null;
    try {
      return calculateDistanceMeters(deviceLocation, selectedLaboratory);
    } catch {
      return null;
    }
  }, [deviceLocation, selectedLaboratory]);

  const isAssistant = activeRole === 'assistant';

  const distanceByLab = useMemo(() => {
    const result: Record<string, number> = {};
    if (!deviceLocation) return result;
    for (const lab of laboratories) {
      try {
        result[lab.id] = calculateDistanceMeters(deviceLocation, lab);
      } catch {
        // koordinat tidak valid: lewati
      }
    }
    return result;
  }, [deviceLocation, laboratories]);

  const startPickMode = () => {
    setPickedLocation(null);
    setPickMode(true);
  };

  const cancelPickMode = () => {
    setPickMode(false);
    setPickedLocation(null);
  };

  const savePickedPosition = async () => {
    if (!selectedLaboratory || !pickedLocation) return;
    setSavingPosition(true);
    try {
      await updateLaboratory(
        selectedLaboratory.id,
        {
          name: selectedLaboratory.name,
          building: selectedLaboratory.building || '-',
          floor: selectedLaboratory.floor || '-',
          latitude: Number(pickedLocation.latitude.toFixed(6)),
          longitude: Number(pickedLocation.longitude.toFixed(6)),
          radius:
            selectedLaboratory.radius >= MIN_LABORATORY_RADIUS_METERS
              ? selectedLaboratory.radius
              : DEFAULT_LABORATORY_RADIUS_METERS,
        },
        { uid: activeUser.id, role: activeRole },
      );
      cancelPickMode();
      showMessage('Berhasil', `Posisi "${selectedLaboratory.name}" diperbarui.`);
    } catch (error) {
      showMessage(
        'Gagal menyimpan',
        error instanceof Error ? error.message : 'Posisi laboratorium gagal disimpan.',
      );
    } finally {
      setSavingPosition(false);
    }
  };

  const lowAccuracy =
    deviceLocation?.accuracy !== null &&
    deviceLocation?.accuracy !== undefined &&
    deviceLocation.accuracy > 50;

  const locationHintText = locationError
    ? locationError.message
    : deviceLocation
      ? `Lokasi Anda: ${deviceLocation.latitude.toFixed(5)}, ${deviceLocation.longitude.toFixed(5)}` +
        (deviceLocation.accuracy !== null ? ` (±${Math.round(deviceLocation.accuracy)} m)` : '') +
        (lowAccuracy ? ' — akurasi rendah, keluar ke area terbuka untuk hasil lebih tepat' : '') +
        (distanceToSelected !== null && selectedLaboratory
          ? ` · ${formatDistanceMeters(distanceToSelected)} dari ${selectedLaboratory.name}`
          : '')
      : locationLoading
        ? 'Mengambil lokasi perangkat...'
        : 'Lokasi perangkat belum tersedia.';

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
        <View style={styles.headerButtons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tampilkan semua laboratorium"
            onPress={() => setFitAllToken(value => value + 1)}
            style={styles.locationButton}>
            <Ionicons name="albums-outline" size={20} color={APP_COLORS.primary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Perbarui lokasi"
            onPress={() => {
              void refreshLocation();
            }}
            style={styles.locationButton}>
            {locationLoading ? (
              <ActivityIndicator color={APP_COLORS.primary} size="small" />
            ) : (
              <Ionicons name="locate-outline" size={21} color={APP_COLORS.primary} />
            )}
          </Pressable>
        </View>
      </View>

      {laboratories.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}>
          {laboratories.map(lab => {
            const active = lab.id === selectedLaboratory?.id;
            const distance = distanceByLab[lab.id];
            return (
              <Pressable
                key={lab.id}
                accessibilityRole="button"
                disabled={pickMode}
                onPress={() => handleSelectLaboratory(lab)}
                style={[styles.chip, active && styles.chipActive]}>
                <View style={[styles.chipDot, active && styles.chipDotActive]} />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {lab.name}
                  {distance !== undefined ? ` · ${formatDistanceMeters(distance)}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.mapContainer}>
        <LaboratoryOSMMap
          laboratories={laboratories}
          selectedLaboratoryId={selectedLaboratory?.id ?? null}
          deviceLocation={deviceLocation}
          initialCenter={mapCenter}
          deviceFocusToken={deviceFocusToken}
          fitAllToken={fitAllToken}
          pickMode={pickMode}
          pickedLocation={pickedLocation}
          onPickLocation={setPickedLocation}
          onSelectLaboratory={handleSelectLaboratory}
        />
        <View style={styles.mapLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#D97706' }]} />
            <Text style={styles.legendText}>Laboratorium</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotSelected]} />
            <Text style={styles.legendText}>Lab terpilih</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
            <Text style={styles.legendText}>Lokasi Anda</Text>
          </View>
        </View>
        {pickMode ? (
          <View style={styles.pickBanner}>
            <Text style={styles.pickBannerText}>
              Ketuk peta tepat di lokasi {selectedLaboratory?.name ?? 'laboratorium'}
            </Text>
          </View>
        ) : null}
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
        {selectedLaboratory ? (
          <Text style={styles.locationHint}>
            Koordinat lab: {selectedLaboratory.latitude.toFixed(6)}, {selectedLaboratory.longitude.toFixed(6)}
          </Text>
        ) : null}
        {isAssistant && selectedLaboratory ? (
          pickMode ? (
            <View style={styles.pickActions}>
              <Pressable
                accessibilityRole="button"
                disabled={!deviceLocation}
                onPress={() => {
                  if (deviceLocation) {
                    setPickedLocation({
                      latitude: deviceLocation.latitude,
                      longitude: deviceLocation.longitude,
                    });
                  }
                }}
                style={[styles.settingsButton, !deviceLocation && styles.buttonDisabled]}>
                <Text style={styles.settingsButtonText}>Pakai lokasi saya</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!pickedLocation || savingPosition}
                onPress={() => {
                  void savePickedPosition();
                }}
                style={[styles.saveButton, (!pickedLocation || savingPosition) && styles.buttonDisabled]}>
                <Text style={styles.saveButtonText}>
                  {savingPosition ? 'Menyimpan...' : 'Simpan posisi'}
                </Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={cancelPickMode} style={styles.settingsButton}>
                <Text style={styles.settingsButtonText}>Batal</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={startPickMode} style={styles.settingsButton}>
              <Text style={styles.settingsButtonText}>Atur posisi lab ini di peta</Text>
            </Pressable>
          )
        ) : null}
        <Text style={[styles.locationHint, locationError && styles.locationHintError]}>
          <Ionicons
            name="location-outline"
            size={12}
            color={locationError ? APP_COLORS.dangerText : APP_COLORS.textSecondary}
          />{' '}
          {locationHintText}
        </Text>
        {locationError?.canOpenSettings ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void openDeviceLocationSettings();
            }}
            style={styles.settingsButton}>
            <Text style={styles.settingsButtonText}>Buka Pengaturan</Text>
          </Pressable>
        ) : null}
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
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  chipScroll: {
    flexGrow: 0,
    marginBottom: APP_SPACING.sm,
  },
  chipRow: {
    paddingHorizontal: APP_SPACING.md,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: APP_RADIUS.pill,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: APP_COLORS.primary,
    borderColor: APP_COLORS.primary,
  },
  chipDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#D97706',
  },
  chipDotActive: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  chipText: {
    fontFamily: APP_FONTS.semiBold,
    color: APP_COLORS.inkPrimary,
    fontSize: 11,
  },
  chipTextActive: {
    color: APP_COLORS.white,
  },
  legendDotSelected: {
    backgroundColor: '#F59E0B',
    borderWidth: 2,
    borderColor: '#17184B',
  },
  pickBanner: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pickBannerText: {
    color: '#fff',
    fontFamily: APP_FONTS.semiBold,
    fontSize: 11,
    textAlign: 'center',
  },
  pickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  saveButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: APP_RADIUS.pill,
    backgroundColor: APP_COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveButtonText: {
    fontFamily: APP_FONTS.semiBold,
    color: APP_COLORS.white,
    fontSize: 10,
  },
  buttonDisabled: {
    opacity: 0.4,
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
    maxHeight: 300,
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
  locationHintError: {
    color: APP_COLORS.dangerText,
  },
  settingsButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: APP_RADIUS.pill,
    backgroundColor: APP_COLORS.softBlue,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  settingsButtonText: {
    fontFamily: APP_FONTS.semiBold,
    color: APP_COLORS.primary,
    fontSize: 10,
  },
});

export default LaboratoryMapScreen;
