/**
 * Birela — read-only data access for the interactive laboratory map.
 *
 * Firestore contract (owned by Yuma):
 * laboratories/{laboratoryId}
 *   name, building, floor, latitude, longitude, radius
 *
 * This module intentionally does not create or update laboratories.
 */
import {
  collection,
  onSnapshot,
} from '@react-native-firebase/firestore';
import { getSafeFirestoreDb } from '@/services/firebaseClient';

export interface LaboratoryLocation {
  id: string;
  name: string;
  building: string;
  floor: string;
  latitude: number;
  longitude: number;
  radius: number;
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapLaboratory(
  id: string,
  raw: Record<string, unknown>,
): LaboratoryLocation | null {
  const latitude = toFiniteNumber(raw.latitude);
  const longitude = toFiniteNumber(raw.longitude);
  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    id,
    name: String(raw.name ?? 'Laboratorium'),
    building: String(raw.building ?? ''),
    floor: String(raw.floor ?? ''),
    latitude,
    longitude,
    radius: Math.max(0, toFiniteNumber(raw.radius) ?? 0),
  };
}

/** Subscribe to Yuma's laboratory collection without changing its schema. */
export function subscribeToLaboratories(
  onData: (items: LaboratoryLocation[]) => void,
  onError: (message: string) => void,
): () => void {
  const db = getSafeFirestoreDb();
  if (!db) {
    onData([]);
    onError('Firestore belum tersedia. Jalankan aplikasi melalui Development Build.');
    return () => undefined;
  }

  return onSnapshot(
    collection(db, 'laboratories'),
    snapshot => {
      const items = snapshot.docs
        .map(item =>
          mapLaboratory(
            item.id,
            item.data() as Record<string, unknown>,
          ),
        )
        .filter((item): item is LaboratoryLocation => item !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
      onData(items);
    },
    error => onError(error.message || 'Gagal memuat data laboratorium.'),
  );
}
