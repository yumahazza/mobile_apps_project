/**
 * Types khusus modul Lintang:
 * - Attendances: presensi praktikan real-time
 * - Feedbacks: pesan & kesan praktikan setelah praktikum
 * - Sentiments: hasil klasifikasi sentimen AI
 */
import type { FieldValue, Timestamp } from '@react-native-firebase/firestore';

export type AttendanceStatus = 'Hadir' | 'Izin' | 'Alfa';

export type SentimentLabel =
  | 'Positif'
  | 'Negatif'
  | 'Netral'
  | 'Tidak Terklasifikasi';

export type AttendanceLocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'SERVICES_DISABLED'
  | 'LOCATION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'STALE_LOCATION'
  | 'INVALID_COORDINATES'
  | 'UNRELIABLE_ACCURACY'
  | 'INVALID_RADIUS'
  | 'OUTSIDE_RADIUS'
  | 'LAB_NOT_FOUND'
  | 'AMBIGUOUS_LAB'
  | 'UNKNOWN_ERROR';

export interface AttendanceLocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

export interface AttendanceLocationValidation {
  isWithinRadius: boolean;
  distanceMeters: number;
  radiusMeters: number;
  laboratoryId: string;
  laboratoryName: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  validatedAt: string;
}

export interface AttendanceFirestoreDoc {
  scheduleId: string;
  studentId: string; // Firebase Auth UID
  studentName: string;
  nim: string;
  timestamp: FieldValue | Timestamp;
  date: string;
  status: 'Hadir';
}

export interface AttendanceRecordItem {
  id: string; // `${scheduleId}_${studentId}`
  scheduleId: string;
  studentId: string;
  studentName: string;
  nim: string;
  timestamp: string; // Tampilan waktu "HH:mm:ss WIB"
  date: string;
  status: AttendanceStatus;
  rawTimestamp?: Timestamp | null;
}

export interface AttendanceStats {
  totalRegistered: number;
  hadirCount: number;
  izinCount: number;
  alfaCount: number;
  attendancePercentage: number;
}

export interface FeedbackFirestoreDoc {
  scheduleId: string;
  studentId: string; // Firebase Auth UID
  studentName: string;
  comment: string;
  sentiment: SentimentLabel;
  createdAt: FieldValue | Timestamp;
}

export interface FeedbackRecordItem {
  id: string; // `${scheduleId}_${studentId}`
  scheduleId: string;
  studentId: string;
  studentName: string;
  comment: string;
  sentiment: SentimentLabel;
  createdAt?: string;
}

export interface AuthenticatedUserContext {
  uid: string;
  name: string;
  nim?: string;
  role: 'assistant' | 'student';
}
