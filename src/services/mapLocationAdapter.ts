/**
 * Birela location adapter.
 *
 * Membungkus helper lokasi bersama (`locationService`, milik Yuma) agar layar
 * peta memakai satu sumber pembacaan lokasi, termasuk penanganan izin ditolak,
 * ditolak permanen, dan GPS/layanan lokasi mati.
 */
import {
  getCurrentDeviceLocation,
  watchDeviceLocation,
} from '@/services/locationService';
import type {
  DeviceLocationData,
  LocationServiceError,
} from '@/types/location';

export interface DeviceCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export type MapLocationResult =
  | { ok: true; data: DeviceCoordinates }
  | { ok: false; error: LocationServiceError };

function toCoordinates(location: DeviceLocationData): DeviceCoordinates {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
  };
}

/** Ambil lokasi sekali (meminta izin bila perlu). */
export async function getCurrentMapLocation(): Promise<MapLocationResult> {
  const result = await getCurrentDeviceLocation({
    allowLastKnownFallback: true,
    promptEnableServices: true,
  });
  if (result.ok) {
    return { ok: true, data: toCoordinates(result.data) };
  }
  return result;
}

/** Pantau lokasi berkelanjutan. Mengembalikan fungsi cleanup yang aman dipanggil kapan saja. */
export function watchMapLocation(
  onUpdate: (coordinates: DeviceCoordinates) => void,
  onError: (error: LocationServiceError) => void,
): () => void {
  return watchDeviceLocation(
    location => onUpdate(toCoordinates(location)),
    onError,
    { distanceInterval: 10, timeInterval: 5000 },
  );
}
