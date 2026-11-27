/**
 * Yuma — Types untuk koleksi Firestore `laboratories` (Sprint 3)
 * Digunakan bersama oleh modul Manajemen Lab (Yuma), Presensi (Lintang), dan Maps (Birela).
 */
import type { FieldValue, Timestamp } from '@react-native-firebase/firestore';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface LaboratoryFirestoreDoc {
  id: string;
  name: string;
  building: string;
  floor: string | number;
  latitude: number;
  longitude: number;
  radius: number; // dalam meter
  createdAt: FieldValue | Timestamp;
  updatedAt: FieldValue | Timestamp;
}

export interface Laboratory {
  id: string;
  name: string;
  building: string;
  floor: string;
  latitude: number;
  longitude: number;
  radius: number; // dalam meter
  createdAt: string;
  updatedAt: string;
  rawCreatedAt?: Timestamp | null;
  rawUpdatedAt?: Timestamp | null;
}

export interface LaboratoryInput {
  name: string;
  building: string;
  floor: string | number;
  latitude: number;
  longitude: number;
  radius: number;
}
