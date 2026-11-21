/**
 * Yuma — Location Service & Geospatial Helpers (Sprint 3)
 *
 * Menyediakan:
 * - Pemeriksaan dan permintaan izin akses lokasi perangkat (`expo-location`)
 * - Penanganan terstruktur kondisi izin ditolak, ditolak permanen, GPS mati, dan lokasi belum tersedia
 * - Pengambilan koordinat saat ini (sekali jalan) & pemantauan lokasi real-time (untuk Maps Birela)
 * - Perhitungan jarak Haversine dan evaluasi radius presensi (untuk Lintang)
 */
import { Linking, Platform } from 'react-native';
import type { Coordinate, Laboratory } from '@/types/laboratory';
import type {
  DeviceLocationData,
  LocationErrorCode,
  LocationPermissionState,
  LocationResult,
  LocationServiceError,
  RadiusCheckResult,
} from '@/types/location';

const EARTH_RADIUS_METERS = 6_371_000;
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_LAST_KNOWN_MAX_AGE_MS = 30_000;

export interface RawExpoLocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

export interface RawExpoLocationObject {
  coords: RawExpoLocationCoords;
  timestamp?: number;
  mocked?: boolean;
}

export interface RawExpoPermissionResponse {
  status: 'granted' | 'denied' | 'undetermined' | string;
  canAskAgain?: boolean;
}

export interface ExpoLocationSubscriptionLike {
  remove: () => void;
}

export interface ExpoLocationLike {
  Accuracy?: {
    Lowest?: number;
    Low?: number;
    Balanced?: number;
    High?: number;
    Highest?: number;
    BestForNavigation?: number;
  };
  hasServicesEnabledAsync: () => Promise<boolean>;
  enableNetworkProviderAsync?: () => Promise<void>;
  getForegroundPermissionsAsync: () => Promise<RawExpoPermissionResponse>;
  requestForegroundPermissionsAsync: () => Promise<RawExpoPermissionResponse>;
  getCurrentPositionAsync: (options?: {
    accuracy?: number;
    mayShowUserSettingsDialog?: boolean;
  }) => Promise<RawExpoLocationObject>;
  getLastKnownPositionAsync?: (options?: {
    maxAge?: number;
    requiredAccuracy?: number;
  }) => Promise<RawExpoLocationObject | null>;
  watchPositionAsync: (
    options: {
      accuracy?: number;
      timeInterval?: number;
      distanceInterval?: number;
    },
    callback: (location: RawExpoLocationObject) => void,
  ) => Promise<ExpoLocationSubscriptionLike>;
}

export interface GetLocationOptions {
  accuracy?: number;
  timeoutMs?: number;
  allowLastKnownFallback?: boolean;
  lastKnownMaxAgeMs?: number;
  promptEnableServices?: boolean;
  locationModule?: ExpoLocationLike | null;
}

export interface WatchLocationOptions {
  accuracy?: number;
  timeInterval?: number;
  distanceInterval?: number;
  promptEnableServices?: boolean;
  locationModule?: ExpoLocationLike | null;
}

function getDefaultExpoLocationModule(): ExpoLocationLike | null {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const mod = require('expo-location') as ExpoLocationLike;
    /* eslint-enable @typescript-eslint/no-require-imports */
    return mod ?? null;
  } catch {
    return null;
  }
}

function resolveLocationModule(
  override?: ExpoLocationLike | null,
): ExpoLocationLike | null {
  if (override !== undefined) {
    return override;
  }
  return getDefaultExpoLocationModule();
}

function normalizePermissionStatus(
  status?: string,
): 'granted' | 'denied' | 'undetermined' {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

function toDeviceLocationData(raw: RawExpoLocationObject): DeviceLocationData {
  return {
    latitude: raw.coords.latitude,
    longitude: raw.coords.longitude,
    accuracy:
      typeof raw.coords.accuracy === 'number' && Number.isFinite(raw.coords.accuracy)
        ? raw.coords.accuracy
        : null,
    timestamp:
      typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp)
        ? raw.timestamp
        : Date.now(),
    ...(typeof raw.mocked === 'boolean' ? { mocked: raw.mocked } : {}),
  };
}

/**
 * Menghasilkan objek error lokasi yang konsisten dan siap ditampilkan di UI.
 */
export function createLocationError(
  code: LocationErrorCode,
  customMessage?: string,
): LocationServiceError {
  switch (code) {
    case 'PERMISSION_DENIED':
      return {
        code,
        title: 'Izin Lokasi Ditolak',
        message:
          customMessage ||
          'Akses lokasi diperlukan untuk membaca koordinat perangkat. Silakan izinkan akses lokasi saat diminta.',
        canAskAgain: true,
        canOpenSettings: false,
      };
    case 'PERMISSION_DENIED_PERMANENTLY':
      return {
        code,
        title: 'Izin Lokasi Dinonaktifkan',
        message:
          customMessage ||
          'Izin lokasi ditolak permanen. Buka Pengaturan aplikasi lalu aktifkan izin lokasi untuk melanjutkan.',
        canAskAgain: false,
        canOpenSettings: true,
      };
    case 'SERVICES_DISABLED':
      return {
        code,
        title: 'Layanan Lokasi Tidak Aktif',
        message:
          customMessage ||
          'GPS atau layanan lokasi perangkat dalam keadaan mati. Aktifkan lokasi perangkat terlebih dahulu.',
        canAskAgain: false,
        canOpenSettings: true,
      };
    case 'LOCATION_UNAVAILABLE':
      return {
        code,
        title: 'Lokasi Belum Tersedia',
        message:
          customMessage ||
          'Koordinat perangkat belum dapat diperoleh. Pastikan sinyal GPS stabil lalu coba lagi.',
        canAskAgain: true,
        canOpenSettings: false,
      };
    case 'PLATFORM_UNSUPPORTED':
      return {
        code,
        title: 'Layanan Lokasi Tidak Tersedia',
        message:
          customMessage ||
          'Modul lokasi perangkat tidak tersedia di lingkungan ini. Gunakan Development Build Android/iOS.',
        canAskAgain: false,
        canOpenSettings: false,
      };
    case 'UNKNOWN_ERROR':
    default:
      return {
        code: 'UNKNOWN_ERROR',
        title: 'Gagal Mengambil Lokasi',
        message:
          customMessage ||
          'Terjadi gangguan saat membaca lokasi perangkat. Silakan coba beberapa saat lagi.',
        canAskAgain: true,
        canOpenSettings: false,
      };
  }
}

function classifyLocationException(error: unknown): LocationServiceError {
  const rawMessage = error instanceof Error ? error.message : String(error ?? '');
  const lower = rawMessage.toLowerCase();

  if (
    lower.includes('permission') ||
    lower.includes('not authorized') ||
    lower.includes('denied')
  ) {
    return createLocationError('PERMISSION_DENIED');
  }
  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('current location is unavailable') ||
    lower.includes('unable to obtain')
  ) {
    return createLocationError('LOCATION_UNAVAILABLE');
  }
  if (
    lower.includes('location services are disabled') ||
    lower.includes('location services disabled') ||
    lower.includes('provider is disabled') ||
    lower.includes('gps')
  ) {
    return createLocationError('SERVICES_DISABLED');
  }
  if (lower.includes('unavailable')) {
    return createLocationError('LOCATION_UNAVAILABLE');
  }
  return createLocationError('UNKNOWN_ERROR', rawMessage || undefined);
}

/**
 * Memeriksa status izin lokasi dan status layanan GPS tanpa memunculkan dialog sistem.
 */
export async function checkLocationReadiness(
  locationModuleOverride?: ExpoLocationLike | null,
): Promise<LocationResult<LocationPermissionState>> {
  const locModule = resolveLocationModule(locationModuleOverride);
  if (!locModule) {
    return { ok: false, error: createLocationError('PLATFORM_UNSUPPORTED') };
  }

  try {
    const [servicesEnabled, permission] = await Promise.all([
      locModule.hasServicesEnabledAsync(),
      locModule.getForegroundPermissionsAsync(),
    ]);
    const normalizedStatus = normalizePermissionStatus(permission.status);
    return {
      ok: true,
      data: {
        granted: normalizedStatus === 'granted',
        status: normalizedStatus,
        canAskAgain: permission.canAskAgain ?? normalizedStatus !== 'denied',
        servicesEnabled: Boolean(servicesEnabled),
      },
    };
  } catch (error) {
    return { ok: false, error: classifyLocationException(error) };
  }
}

/**
 * Memeriksa dan meminta izin lokasi foreground dengan penanganan penolakan permanen.
 */
export async function requestForegroundLocationPermission(
  locationModuleOverride?: ExpoLocationLike | null,
): Promise<LocationResult<LocationPermissionState>> {
  const locModule = resolveLocationModule(locationModuleOverride);
  if (!locModule) {
    return { ok: false, error: createLocationError('PLATFORM_UNSUPPORTED') };
  }

  try {
    let permission = await locModule.getForegroundPermissionsAsync();
    let status = normalizePermissionStatus(permission.status);
    let canAskAgain = permission.canAskAgain ?? true;

    if (status !== 'granted') {
      if (!canAskAgain) {
        return {
          ok: false,
          error: createLocationError('PERMISSION_DENIED_PERMANENTLY'),
        };
      }

      permission = await locModule.requestForegroundPermissionsAsync();
      status = normalizePermissionStatus(permission.status);
      canAskAgain = permission.canAskAgain ?? false;

      if (status !== 'granted') {
        return {
          ok: false,
          error: createLocationError(
            canAskAgain ? 'PERMISSION_DENIED' : 'PERMISSION_DENIED_PERMANENTLY',
          ),
        };
      }
    }

    const servicesEnabled = await locModule.hasServicesEnabledAsync();
    return {
      ok: true,
      data: {
        granted: true,
        status: 'granted',
        canAskAgain: true,
        servicesEnabled: Boolean(servicesEnabled),
      },
    };
  } catch (error) {
    return { ok: false, error: classifyLocationException(error) };
  }
}

async function ensureLocationServicesEnabled(
  locModule: ExpoLocationLike,
  promptEnableServices: boolean,
): Promise<LocationResult<true>> {
  let enabled = await locModule.hasServicesEnabledAsync();

  if (
    !enabled &&
    promptEnableServices &&
    Platform.OS === 'android' &&
    typeof locModule.enableNetworkProviderAsync === 'function'
  ) {
    try {
      await locModule.enableNetworkProviderAsync();
      enabled = await locModule.hasServicesEnabledAsync();
    } catch {
      enabled = false;
    }
  }

  if (!enabled) {
    return { ok: false, error: createLocationError('SERVICES_DISABLED') };
  }

  return { ok: true, data: true };
}

function getPositionWithTimeout(
  locModule: ExpoLocationLike,
  accuracy: number,
  timeoutMs: number,
): Promise<RawExpoLocationObject> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Location request timed out'));
      }
    }, timeoutMs);

    locModule
      .getCurrentPositionAsync({
        accuracy,
        mayShowUserSettingsDialog: Platform.OS === 'android',
      })
      .then((result) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }
      })
      .catch((error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      });
  });
}

/**
 * Mengambil koordinat perangkat saat ini dengan validasi izin, status GPS, dan batas timeout.
 * Secara default tidak memakai lokasi lama (allowLastKnownFallback: false) demi keakuratan presensi.
 */
export async function getCurrentDeviceLocation(
  options: GetLocationOptions = {},
): Promise<LocationResult<DeviceLocationData>> {
  const locModule = resolveLocationModule(options.locationModule);
  if (!locModule) {
    return { ok: false, error: createLocationError('PLATFORM_UNSUPPORTED') };
  }

  const permissionResult = await requestForegroundLocationPermission(locModule);
  if (!permissionResult.ok) {
    return permissionResult;
  }

  const servicesResult = await ensureLocationServicesEnabled(
    locModule,
    options.promptEnableServices !== false,
  );
  if (!servicesResult.ok) {
    return servicesResult;
  }

  const accuracy = options.accuracy ?? locModule.Accuracy?.High ?? 4;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const position = await getPositionWithTimeout(locModule, accuracy, timeoutMs);
    if (
      !position?.coords ||
      !Number.isFinite(position.coords.latitude) ||
      !Number.isFinite(position.coords.longitude)
    ) {
      return { ok: false, error: createLocationError('LOCATION_UNAVAILABLE') };
    }
    return { ok: true, data: toDeviceLocationData(position) };
  } catch (error) {
    if (
      options.allowLastKnownFallback &&
      typeof locModule.getLastKnownPositionAsync === 'function'
    ) {
      try {
        const lastKnown = await locModule.getLastKnownPositionAsync({
          maxAge: options.lastKnownMaxAgeMs ?? DEFAULT_LAST_KNOWN_MAX_AGE_MS,
          requiredAccuracy: 100,
        });
        if (
          lastKnown?.coords &&
          Number.isFinite(lastKnown.coords.latitude) &&
          Number.isFinite(lastKnown.coords.longitude)
        ) {
          return { ok: true, data: toDeviceLocationData(lastKnown) };
        }
      } catch {
        // Lanjutkan ke penanganan error utama bila fallback juga gagal
      }
    }

    const mapped = classifyLocationException(error);
    if (mapped.code === 'UNKNOWN_ERROR') {
      return { ok: false, error: createLocationError('LOCATION_UNAVAILABLE') };
    }
    return { ok: false, error: mapped };
  }
}

/**
 * Memulai pemantauan perubahan lokasi perangkat secara berkelanjutan (digunakan halaman Maps Birela).
 * Mengembalikan fungsi cleanup sinkron yang aman terhadap unmount sebelum promise selesai.
 */
export function watchDeviceLocation(
  onLocation: (location: DeviceLocationData) => void,
  onError: (error: LocationServiceError) => void,
  options: WatchLocationOptions = {},
): () => void {
  const locModule = resolveLocationModule(options.locationModule);
  if (!locModule) {
    onError(createLocationError('PLATFORM_UNSUPPORTED'));
    return () => undefined;
  }

  let isCancelled = false;
  let subscription: ExpoLocationSubscriptionLike | null = null;

  const startWatching = async () => {
    const permissionResult = await requestForegroundLocationPermission(locModule);
    if (isCancelled) return;
    if (!permissionResult.ok) {
      onError(permissionResult.error);
      return;
    }

    const servicesResult = await ensureLocationServicesEnabled(
      locModule,
      options.promptEnableServices === true,
    );
    if (isCancelled) return;
    if (!servicesResult.ok) {
      onError(servicesResult.error);
      return;
    }

    try {
      const sub = await locModule.watchPositionAsync(
        {
          accuracy: options.accuracy ?? locModule.Accuracy?.High ?? 4,
          timeInterval: options.timeInterval ?? 5_000,
          distanceInterval: options.distanceInterval ?? 5,
        },
        (position) => {
          if (isCancelled) return;
          if (
            !position?.coords ||
            !Number.isFinite(position.coords.latitude) ||
            !Number.isFinite(position.coords.longitude)
          ) {
            onError(createLocationError('LOCATION_UNAVAILABLE'));
            return;
          }
          onLocation(toDeviceLocationData(position));
        },
      );

      if (isCancelled) {
        sub.remove();
        return;
      }
      subscription = sub;
    } catch (error) {
      if (!isCancelled) {
        onError(classifyLocationException(error));
      }
    }
  };

  void startWatching();

  return () => {
    isCancelled = true;
    if (subscription) {
      subscription.remove();
      subscription = null;
    }
  };
}

/**
 * Membuka halaman Pengaturan aplikasi agar pengguna dapat mengaktifkan izin atau layanan lokasi.
 */
export async function openDeviceLocationSettings(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}

/**
 * Menghitung jarak antara dua koordinat GPS dalam satuan meter (formula Haversine).
 */
export function calculateDistanceMeters(
  origin: Coordinate,
  destination: Coordinate,
): number {
  if (
    !Number.isFinite(origin.latitude) ||
    !Number.isFinite(origin.longitude) ||
    !Number.isFinite(destination.latitude) ||
    !Number.isFinite(destination.longitude)
  ) {
    throw new Error('Koordinat lokasi tidak valid.');
  }

  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRadians(destination.latitude - origin.latitude);
  const dLon = toRadians(destination.longitude - origin.longitude);
  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(destination.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c * 100) / 100;
}

/**
 * Mengevaluasi apakah koordinat pengguna berada dalam radius presensi laboratorium.
 */
export function evaluateAttendanceRadius(
  userCoordinate: Coordinate,
  laboratory: Pick<Laboratory, 'latitude' | 'longitude' | 'radius'>,
): RadiusCheckResult {
  const distanceMeters = calculateDistanceMeters(userCoordinate, {
    latitude: laboratory.latitude,
    longitude: laboratory.longitude,
  });
  return {
    distanceMeters,
    radiusMeters: laboratory.radius,
    isWithinRadius: distanceMeters <= laboratory.radius,
  };
}

/**
 * Memformat jarak dalam meter agar ringkas dan mudah dibaca di UI.
 */
export function formatDistanceMeters(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '-';
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2).replace('.', ',')} km`;
}
