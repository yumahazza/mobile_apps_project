/**
 * Yuma — Types untuk layanan lokasi perangkat & penanganan izin (Sprint 3)
 * Menyediakan format hasil dan error yang konsisten untuk Lintang (presensi) & Birela (Maps).
 */

export type LocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'PERMISSION_DENIED_PERMANENTLY'
  | 'SERVICES_DISABLED'
  | 'LOCATION_UNAVAILABLE'
  | 'PLATFORM_UNSUPPORTED'
  | 'UNKNOWN_ERROR';

export interface LocationServiceError {
  code: LocationErrorCode;
  title: string;
  message: string;
  canAskAgain: boolean;
  canOpenSettings: boolean;
}

export interface DeviceLocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
  mocked?: boolean;
}

export interface LocationPermissionState {
  granted: boolean;
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  servicesEnabled: boolean;
}

export type LocationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: LocationServiceError };

export interface RadiusCheckResult {
  distanceMeters: number;
  radiusMeters: number;
  isWithinRadius: boolean;
}
