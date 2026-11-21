/**
 * Birela location adapter.
 *
 * The Sprint 3 task document says this screen should consume the shared
 * location helper prepared by Yuma. That helper was not present in the
 * Sprint 2 project archive supplied for this task, so this adapter currently
 * uses Expo Location behind a small interface. When Yuma's helper is merged,
 * replace the implementation here only; LaboratoryMapScreen stays unchanged.
 */
import * as Location from 'expo-location';

export interface DeviceCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export type LocationUpdate = (coordinates: DeviceCoordinates) => void;

export async function requestMapLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;

  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
}

export async function getCurrentMapLocation(): Promise<DeviceCoordinates> {
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
  };
}

export async function watchMapLocation(
  onUpdate: LocationUpdate,
): Promise<Location.LocationSubscription> {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,
      distanceInterval: 10,
    },
    position => {
      onUpdate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    },
  );
}
