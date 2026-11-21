/**
 * Lintang — Attendance Geolocation Service (Sprint 3)
 *
 * Mengelola validasi lokasi perangkat dan radius laboratorium untuk presensi praktikan:
 * - Mengambil koordinat perangkat dengan izin GPS (menggunakan Expo Location)
 * - Menghitung jarak geodesik menggunakan rumus Haversine
 * - Memvalidasi posisi mahasiswa terhadap batas radius laboratorium
 * - Memetakan jadwal ke data laboratorium secara fail-closed (tidak menebak/mengira-ngira)
 * - Memverifikasi seluruh syarat kelayakan presensi
 *
 * CATATAN INTEGRASI YUMA:
 * Modul ini menggunakan adapter lokasi mandiri terisolasi karena helper bersama Yuma
 * belum di-merge ke branch utama pada Sprint 3. Begitu helper publik Yuma tersedia,
 * delegasi pengambilan lokasi dapat diarahkan ke modul Yuma tanpa mengubah kontrak publik file ini.
 */
import * as Location from 'expo-location';
import type { LaboratoryLocation } from '@/services/laboratoryMapService';
import type {
  AttendanceLocationCoordinates,
  AttendanceLocationErrorCode,
  AttendanceLocationValidation,
} from '@/types/attendance';

export interface DeviceLocationResult {
  success: boolean;
  coordinates: AttendanceLocationCoordinates | null;
  errorCode: AttendanceLocationErrorCode | null;
  errorMessage: string | null;
}

export type RadiusValidationStatus =
  | 'WITHIN_RADIUS'
  | 'OUTSIDE_RADIUS'
  | 'INVALID_COORDINATES'
  | 'INVALID_RADIUS'
  | 'UNRELIABLE_ACCURACY';

export interface RadiusValidationResult {
  distanceMeters: number;
  radiusMeters: number;
  isWithinRadius: boolean;
  status: RadiusValidationStatus;
  message: string;
}

export type LaboratoryMatchStatus =
  | 'MATCHED_BY_ID'
  | 'MATCHED_BY_ROOM'
  | 'NOT_FOUND'
  | 'AMBIGUOUS'
  | 'NO_LABORATORIES';

export interface LaboratoryMatchResult {
  laboratory: LaboratoryLocation | null;
  status: LaboratoryMatchStatus;
  message: string;
}

export interface AttendanceEligibilityResult {
  eligible: boolean;
  reason: string;
  code:
    | 'ELIGIBLE'
    | 'SESSION_NOT_OPEN'
    | 'SESSION_FINISHED'
    | 'ALREADY_ATTENDED'
    | 'NOT_ENROLLED'
    | 'LOCATION_INVALID'
    | 'LAB_INVALID'
    | 'OUTSIDE_RADIUS'
    | 'CHECKING_LOCATION';
}

/**
 * Menghitung jarak lingkaran besar (geodesik) antara dua koordinat menggunakan formula Haversine.
 * Hasil dalam satuan meter (pembulatan 1 desimal).
 * Mengembalikan NaN jika salah satu koordinat tidak valid.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2) ||
    lat1 < -90 ||
    lat1 > 90 ||
    lat2 < -90 ||
    lat2 > 90 ||
    lon1 < -180 ||
    lon1 > 180 ||
    lon2 < -180 ||
    lon2 > 180
  ) {
    return NaN;
  }

  // Jika koordinat identik, jarak persis 0 meter
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const R = 6371000; // Radius rata-rata bumi dalam meter
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) *
      Math.cos(lat2 * toRad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10;
}

/**
 * Memvalidasi apakah posisi mahasiswa berada dalam radius yang diizinkan laboratorium.
 * Jarak <= radius berarti valid (dalam radius).
 * Jarak > radius berarti presensi ditolak.
 */
export function validateAttendanceRadius(
  userLat: number,
  userLon: number,
  labLat: number,
  labLon: number,
  radiusMeters: number,
  accuracyMeters?: number | null,
): RadiusValidationResult {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    return {
      distanceMeters: NaN,
      radiusMeters: radiusMeters ?? 0,
      isWithinRadius: false,
      status: 'INVALID_RADIUS',
      message: 'Radius presensi laboratorium tidak valid atau belum diatur oleh asisten.',
    };
  }

  const distance = calculateHaversineDistance(userLat, userLon, labLat, labLon);
  if (Number.isNaN(distance)) {
    return {
      distanceMeters: NaN,
      radiusMeters,
      isWithinRadius: false,
      status: 'INVALID_COORDINATES',
      message: 'Koordinat lokasi perangkat atau laboratorium tidak valid.',
    };
  }

  // Validasi akurasi GPS: jika ketidakpastian > 150m, data lokasi dianggap tidak reliabel
  if (accuracyMeters !== undefined && accuracyMeters !== null) {
    if (accuracyMeters < 0 || accuracyMeters > 150) {
      return {
        distanceMeters: distance,
        radiusMeters,
        isWithinRadius: false,
        status: 'UNRELIABLE_ACCURACY',
        message: `Akurasi sinyal GPS perangkat rendah (±${Math.round(
          accuracyMeters,
        )}m). Pindahlah ke dekat jendela atau luar ruangan untuk sinyal lebih akurat.`,
      };
    }
  }

  const isWithin = distance <= radiusMeters;
  return {
    distanceMeters: distance,
    radiusMeters,
    isWithinRadius: isWithin,
    status: isWithin ? 'WITHIN_RADIUS' : 'OUTSIDE_RADIUS',
    message: isWithin
      ? `Lokasi Anda berada dalam radius presensi (${distance}m dari lab, batas maksimal ${radiusMeters}m).`
      : `Anda berada di luar radius presensi laboratorium (${distance}m dari lab, batas maksimal ${radiusMeters}m).`,
  };
}

/**
 * Pemetaan jadwal praktikum ke laboratorium terdaftar:
 * 1. Jika jadwal memiliki explicit `laboratoryId`, cocokkan dengan `lab.id`.
 * 2. Jika tidak ada `laboratoryId`, cocokkan `schedule.room` secara persis (unambiguous exact match).
 * 3. Jika tidak cocok atau terdapat duplikasi (ambigu): FAIL CLOSED.
 * DILARANG menebak, mengira-ngira, atau memilih lab terdekat secara otomatis.
 */
export function matchScheduleToLaboratory(
  schedule: { room: string; laboratoryId?: string },
  laboratories: LaboratoryLocation[],
): LaboratoryMatchResult {
  if (!laboratories || laboratories.length === 0) {
    return {
      laboratory: null,
      status: 'NO_LABORATORIES',
      message: 'Data laboratorium belum terdaftar di sistem. Hubungi administrator.',
    };
  }

  // 1. Explicit laboratoryId match
  if (schedule.laboratoryId?.trim()) {
    const targetId = schedule.laboratoryId.trim();
    const found = laboratories.find(l => l.id === targetId);
    if (found) {
      return {
        laboratory: found,
        status: 'MATCHED_BY_ID',
        message: `Laboratorium terverifikasi via ID: ${found.name}`,
      };
    }
    return {
      laboratory: null,
      status: 'NOT_FOUND',
      message: `Laboratorium dengan ID "${targetId}" tidak ditemukan pada sistem.`,
    };
  }

  // 2. Unambiguous exact match dengan room
  const roomName = (schedule.room || '').trim().toLowerCase();
  if (!roomName) {
    return {
      laboratory: null,
      status: 'NOT_FOUND',
      message: 'Ruangan pada jadwal praktikum tidak didefinisikan.',
    };
  }

  const exactMatches = laboratories.filter(
    l =>
      l.name.trim().toLowerCase() === roomName ||
      l.id.trim().toLowerCase() === roomName,
  );

  if (exactMatches.length === 1) {
    return {
      laboratory: exactMatches[0],
      status: 'MATCHED_BY_ROOM',
      message: `Laboratorium terverifikasi via nama ruangan: ${exactMatches[0].name}`,
    };
  }

  if (exactMatches.length > 1) {
    return {
      laboratory: null,
      status: 'AMBIGUOUS',
      message: `Ditemukan lebih dari satu laboratorium dengan nama "${schedule.room}". Pemetaan ambigu.`,
    };
  }

  // Fail closed
  return {
    laboratory: null,
    status: 'NOT_FOUND',
    message: `Ruangan "${schedule.room}" tidak cocok dengan data laboratorium terdaftar. Presensi tidak dapat diproses.`,
  };
}

/**
 * Mengambil koordinat perangkat saat ini menggunakan Expo Location.
 * Menangani:
 * - GPS nonaktif
 * - Izin ditolak
 * - Timeout
 * - Koordinat tidak valid
 * - Data lokasi kedaluwarsa (> maxAgeMs)
 */
export async function getDeviceAttendanceLocation(
  maxAgeMs: number = 300000, // 5 menit
  timeoutMs: number = 15000, // 15 detik
): Promise<DeviceLocationResult> {
  try {
    // 1. Cek apakah layanan GPS aktif
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      return {
        success: false,
        coordinates: null,
        errorCode: 'SERVICES_DISABLED',
        errorMessage: 'Layanan lokasi (GPS) pada perangkat nonaktif. Harap aktifkan GPS Anda.',
      };
    }

    // 2. Cek izin akses lokasi
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) {
      if (perm.canAskAgain) {
        perm = await Location.requestForegroundPermissionsAsync();
      }
      if (!perm.granted) {
        return {
          success: false,
          coordinates: null,
          errorCode: 'PERMISSION_DENIED',
          errorMessage:
            'Izin akses lokasi ditolak. Aplikasi membutuhkan izin GPS untuk memvalidasi presensi di laboratorium.',
        };
      }
    }

    // 3. Ambil posisi saat ini dengan batas timeout
    const positionPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs),
    );

    let position: Location.LocationObject;
    try {
      position = await Promise.race([positionPromise, timeoutPromise]);
    } catch (e) {
      if (e instanceof Error && e.message === 'TIMEOUT') {
        return {
          success: false,
          coordinates: null,
          errorCode: 'TIMEOUT',
          errorMessage: 'Waktu permintaan lokasi habis. Pastikan sinyal GPS cukup kuat dan coba lagi.',
        };
      }
      return {
        success: false,
        coordinates: null,
        errorCode: 'LOCATION_UNAVAILABLE',
        errorMessage: 'Gagal mendeteksi lokasi perangkat. Silakan coba kembali.',
      };
    }

    if (!position || !position.coords) {
      return {
        success: false,
        coordinates: null,
        errorCode: 'LOCATION_UNAVAILABLE',
        errorMessage: 'Data koordinat GPS tidak tersedia dari perangkat.',
      };
    }

    const { latitude, longitude, accuracy } = position.coords;
    const timestamp = position.timestamp;

    // 4. Validasi keabsahan koordinat
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return {
        success: false,
        coordinates: null,
        errorCode: 'INVALID_COORDINATES',
        errorMessage: 'Koordinat yang diterima dari perangkat tidak valid.',
      };
    }

    // 5. Cek kedaluwarsa data
    if (timestamp && Date.now() - timestamp > maxAgeMs) {
      return {
        success: false,
        coordinates: null,
        errorCode: 'STALE_LOCATION',
        errorMessage: 'Data lokasi perangkat sudah kedaluwarsa. Silakan perbarui lokasi.',
      };
    }

    return {
      success: true,
      coordinates: {
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        timestamp,
      },
      errorCode: null,
      errorMessage: null,
    };
  } catch (err) {
    return {
      success: false,
      coordinates: null,
      errorCode: 'UNKNOWN_ERROR',
      errorMessage:
        err instanceof Error ? err.message : 'Terjadi kesalahan saat memeriksa lokasi.',
    };
  }
}

/**
 * Evaluasi kelayakan presensi secara komprehensif.
 */
export function evaluateAttendanceEligibility(params: {
  sessionStatus: string;
  isEnrolled: boolean;
  hasAttendanceRecord: boolean;
  isLocationChecking: boolean;
  radiusValidation: RadiusValidationResult | null;
  laboratory: LaboratoryLocation | null;
}): AttendanceEligibilityResult {
  const {
    sessionStatus,
    isEnrolled,
    hasAttendanceRecord,
    isLocationChecking,
    radiusValidation,
    laboratory,
  } = params;

  if (hasAttendanceRecord) {
    return {
      eligible: false,
      code: 'ALREADY_ATTENDED',
      reason: 'Anda sudah melakukan presensi pada sesi ini.',
    };
  }

  if (sessionStatus === 'BELUM_DIBUKA') {
    return {
      eligible: false,
      code: 'SESSION_NOT_OPEN',
      reason: 'Sesi praktikum belum dibuka oleh asisten.',
    };
  }

  if (sessionStatus === 'SELESAI') {
    return {
      eligible: false,
      code: 'SESSION_FINISHED',
      reason: 'Sesi praktikum telah selesai.',
    };
  }

  if (sessionStatus !== 'DIBUKA') {
    return {
      eligible: false,
      code: 'SESSION_NOT_OPEN',
      reason: 'Sesi praktikum saat ini tidak aktif.',
    };
  }

  if (!isEnrolled) {
    return {
      eligible: false,
      code: 'NOT_ENROLLED',
      reason: 'Anda tidak terdaftar sebagai peserta pada jadwal praktikum ini.',
    };
  }

  if (isLocationChecking) {
    return {
      eligible: false,
      code: 'CHECKING_LOCATION',
      reason: 'Sedang memeriksa lokasi perangkat Anda...',
    };
  }

  if (!laboratory) {
    return {
      eligible: false,
      code: 'LAB_INVALID',
      reason: 'Laboratorium tidak dapat diverifikasi untuk jadwal ini.',
    };
  }

  if (!radiusValidation) {
    return {
      eligible: false,
      code: 'LOCATION_INVALID',
      reason: 'Lokasi perangkat belum berhasil diverifikasi.',
    };
  }

  if (!radiusValidation.isWithinRadius) {
    return {
      eligible: false,
      code: 'OUTSIDE_RADIUS',
      reason: radiusValidation.message,
    };
  }

  return {
    eligible: true,
    code: 'ELIGIBLE',
    reason: 'Seluruh syarat terpenuhi. Anda dapat melakukan presensi.',
  };
}
