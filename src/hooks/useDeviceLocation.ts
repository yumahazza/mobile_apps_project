/**
 * Yuma — Hook Pembacaan Lokasi Perangkat (Sprint 3)
 * Membungkus `getCurrentDeviceLocation` dan `openDeviceLocationSettings` untuk UI.
 */
import { useCallback, useState } from 'react';
import {
  getCurrentDeviceLocation,
  openDeviceLocationSettings,
  type GetLocationOptions,
} from '@/services/locationService';
import type { DeviceLocationData, LocationServiceError } from '@/types/location';

interface UseDeviceLocationReturn {
  location: DeviceLocationData | null;
  loading: boolean;
  error: LocationServiceError | null;
  fetchLocation: (
    options?: GetLocationOptions,
  ) => Promise<DeviceLocationData | null>;
  clearError: () => void;
  openSettings: () => Promise<boolean>;
}

export function useDeviceLocation(): UseDeviceLocationReturn {
  const [location, setLocation] = useState<DeviceLocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LocationServiceError | null>(null);

  const fetchLocation = useCallback(
    async (options: GetLocationOptions = {}): Promise<DeviceLocationData | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await getCurrentDeviceLocation(options);
        if (result.ok) {
          setLocation(result.data);
          return result.data;
        }
        setError(result.error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const openSettings = useCallback(() => openDeviceLocationSettings(), []);

  return {
    location,
    loading,
    error,
    fetchLocation,
    clearError,
    openSettings,
  };
}
