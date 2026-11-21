/**
 * Yuma — Unit & Logic Tests for Sprint 3
 * Menguji seluruh aturan bisnis modul Yuma:
 * - Test 1: Parsing & validasi input laboratorium (koordinat, radius, nama, gedung, lantai)
 * - Test 2: Perhitungan jarak Haversine, evaluasi radius presensi, dan format jarak
 * - Test 3: Resolusi relasi jadwal <-> laboratorium (prioritas laboratoryId + fallback room)
 * - Test 4: Layanan lokasi & penanganan kondisi izin / GPS mati / timeout / cleanup watchPosition
 */
import {
  calculateDistanceMeters,
  checkLocationReadiness,
  evaluateAttendanceRadius,
  formatDistanceMeters,
  getCurrentDeviceLocation,
  requestForegroundLocationPermission,
  watchDeviceLocation,
  type ExpoLocationLike,
} from '../services/locationService';
import {
  findSchedulesReferencingLaboratory,
  parseCoordinateInput,
  parseRadiusInput,
  resolveLaboratoryForSchedule,
  validateLaboratoryInput,
} from '../services/laboratoryService';
import type { Laboratory } from '../types/laboratory';

function createMockLocationModule(
  overrides: Partial<ExpoLocationLike> = {},
): ExpoLocationLike {
  return {
    Accuracy: {
      Lowest: 1,
      Low: 2,
      Balanced: 3,
      High: 4,
      Highest: 5,
      BestForNavigation: 6,
    },
    hasServicesEnabledAsync: async () => true,
    enableNetworkProviderAsync: async () => undefined,
    getForegroundPermissionsAsync: async () => ({
      status: 'granted',
      canAskAgain: true,
    }),
    requestForegroundPermissionsAsync: async () => ({
      status: 'granted',
      canAskAgain: true,
    }),
    getCurrentPositionAsync: async () => ({
      coords: {
        latitude: -7.770615,
        longitude: 110.377812,
        accuracy: 8.5,
      },
      timestamp: 1700000000000,
      mocked: false,
    }),
    getLastKnownPositionAsync: async () => null,
    watchPositionAsync: async (_options, callback) => {
      callback({
        coords: {
          latitude: -7.770615,
          longitude: 110.377812,
          accuracy: 6,
        },
        timestamp: 1700000001000,
      });
      return { remove: () => undefined };
    },
    ...overrides,
  };
}

export async function runYumaTests(): Promise<{
  passed: number;
  failed: number;
  results: { name: string; success: boolean; detail?: string }[];
}> {
  const results: { name: string; success: boolean; detail?: string }[] = [];

  function assert(name: string, condition: boolean, detail?: string) {
    results.push({ name, success: condition, detail });
    if (!condition) {
      console.error(`❌ FAILED: ${name} - ${detail || ''}`);
    } else {
      console.log(`✅ PASSED: ${name}`);
    }
  }

  // 1. Parsing koordinat & radius
  assert(
    'parseCoordinateInput menerima desimal koma dan titik secara akurat',
    parseCoordinateInput('-7,770615') === -7.770615 &&
      parseCoordinateInput('110.377812') === 110.377812,
  );
  assert(
    'parseCoordinateInput menolak string non-numerik parsial',
    parseCoordinateInput('-7.77abc') === null &&
      parseCoordinateInput('') === null &&
      parseRadiusInput('50m') === null &&
      parseRadiusInput('75') === 75,
  );

  // 2. Validasi input laboratorium
  const validInput = {
    name: 'Lab Komputer 1',
    building: 'Gedung F',
    floor: '2',
    latitude: -7.770615,
    longitude: 110.377812,
    radius: 50,
  };
  assert(
    'validateLaboratoryInput meloloskan data laboratorium valid',
    validateLaboratoryInput(validInput) === null,
  );
  assert(
    'validateLaboratoryInput menolak latitude di luar rentang [-90, 90]',
    validateLaboratoryInput({ ...validInput, latitude: 91 }) !== null &&
      validateLaboratoryInput({ ...validInput, latitude: -91 }) !== null,
  );
  assert(
    'validateLaboratoryInput menolak longitude di luar rentang [-180, 180]',
    validateLaboratoryInput({ ...validInput, longitude: 181 }) !== null,
  );
  assert(
    'validateLaboratoryInput menolak radius di bawah minimum (< 5 m) atau di atas 5000 m',
    validateLaboratoryInput({ ...validInput, radius: 4 }) !== null &&
      validateLaboratoryInput({ ...validInput, radius: 5001 }) !== null,
  );
  assert(
    'validateLaboratoryInput menolak nama/gedung/lantai kosong',
    validateLaboratoryInput({ ...validInput, name: ' ' }) !== null &&
      validateLaboratoryInput({ ...validInput, building: '' }) !== null &&
      validateLaboratoryInput({ ...validInput, floor: '   ' }) !== null,
  );

  // 3. Perhitungan jarak Haversine & evaluasi radius
  const labSample: Laboratory = {
    id: 'lab-1',
    name: 'Lab Komputer 1',
    building: 'Gedung Ilmu Komputer',
    floor: '2',
    latitude: -7.770615,
    longitude: 110.377812,
    radius: 50,
    createdAt: '21 Nov 2026',
    updatedAt: '21 Nov 2026',
  };

  assert(
    'calculateDistanceMeters mengembalikan 0 untuk koordinat identik',
    calculateDistanceMeters(
      { latitude: labSample.latitude, longitude: labSample.longitude },
      { latitude: labSample.latitude, longitude: labSample.longitude },
    ) === 0,
  );

  const nearbyCheck = evaluateAttendanceRadius(
    { latitude: -7.77075, longitude: 110.377812 }, // ~15 meter ke selatan
    labSample,
  );
  assert(
    'evaluateAttendanceRadius mendeteksi posisi dalam radius (<= 50m)',
    nearbyCheck.isWithinRadius &&
      nearbyCheck.distanceMeters > 10 &&
      nearbyCheck.distanceMeters < 25,
    `Actual distance: ${nearbyCheck.distanceMeters}m`,
  );

  const farCheck = evaluateAttendanceRadius(
    { latitude: -7.772, longitude: 110.377812 }, // ~154 meter ke selatan
    labSample,
  );
  assert(
    'evaluateAttendanceRadius menolak posisi di luar radius (> 50m)',
    !farCheck.isWithinRadius && farCheck.distanceMeters > 100,
    `Actual distance: ${farCheck.distanceMeters}m`,
  );
  assert(
    'formatDistanceMeters memformat satuan meter dan kilometer dengan benar',
    formatDistanceMeters(42.4) === '42 m' &&
      formatDistanceMeters(1250) === '1,25 km',
  );

  // 4. Resolusi Jadwal <-> Lab & deteksi referensi jadwal
  const lab2: Laboratory = {
    ...labSample,
    id: 'lab-2',
    name: 'Lab Jaringan',
  };
  assert(
    'resolveLaboratoryForSchedule memprioritaskan laboratoryId daripada room',
    resolveLaboratoryForSchedule(
      { laboratoryId: 'lab-2', room: 'Lab Komputer 1' },
      [labSample, lab2],
    )?.id === 'lab-2',
  );
  assert(
    'resolveLaboratoryForSchedule melakukan fallback pencocokan nama room case-insensitive',
    resolveLaboratoryForSchedule(
      { laboratoryId: null, room: '  lab   komputer 1 ' },
      [labSample, lab2],
    )?.id === 'lab-1',
  );

  const refSummary = findSchedulesReferencingLaboratory(labSample, [
    {
      id: 's1',
      courseName: 'Mobile',
      className: 'A',
      room: 'Lab Komputer 1',
      laboratoryId: 'lab-1',
      status: 'DIBUKA',
    },
    {
      id: 's2',
      courseName: 'Basis Data',
      className: 'B',
      room: 'Lab Komputer 1',
      laboratoryId: null,
      status: 'SELESAI',
    },
  ]);
  assert(
    'findSchedulesReferencingLaboratory memisahkan jadwal DIBUKA dan non-aktif',
    refSummary.openSchedules.length === 1 &&
      refSummary.otherSchedules.length === 1,
  );

  // 5. Layanan lokasi & penanganan izin perangkat (mock expo-location)
  const readinessOk = await checkLocationReadiness(createMockLocationModule());
  assert(
    'checkLocationReadiness mengembalikan status granted & GPS aktif',
    readinessOk.ok && readinessOk.data.granted && readinessOk.data.servicesEnabled,
  );

  const successLoc = await getCurrentDeviceLocation({
    locationModule: createMockLocationModule(),
  });
  assert(
    'getCurrentDeviceLocation mengembalikan koordinat & akurasi saat izin & GPS aktif',
    successLoc.ok &&
      successLoc.data.latitude === -7.770615 &&
      successLoc.data.accuracy === 8.5,
  );

  const deniedTemp = await getCurrentDeviceLocation({
    locationModule: createMockLocationModule({
      getForegroundPermissionsAsync: async () => ({
        status: 'undetermined',
        canAskAgain: true,
      }),
      requestForegroundPermissionsAsync: async () => ({
        status: 'denied',
        canAskAgain: true,
      }),
    }),
  });
  assert(
    'Izin ditolak sementara menghasilkan PERMISSION_DENIED dengan canAskAgain=true',
    !deniedTemp.ok &&
      deniedTemp.error.code === 'PERMISSION_DENIED' &&
      deniedTemp.error.canAskAgain &&
      !deniedTemp.error.canOpenSettings,
  );

  let requestedWhenPermanent = false;
  const deniedPerm = await requestForegroundLocationPermission(
    createMockLocationModule({
      getForegroundPermissionsAsync: async () => ({
        status: 'denied',
        canAskAgain: false,
      }),
      requestForegroundPermissionsAsync: async () => {
        requestedWhenPermanent = true;
        return { status: 'denied', canAskAgain: false };
      },
    }),
  );
  assert(
    'Izin ditolak permanen langsung menghasilkan PERMISSION_DENIED_PERMANENTLY dengan canOpenSettings=true',
    !deniedPerm.ok &&
      deniedPerm.error.code === 'PERMISSION_DENIED_PERMANENTLY' &&
      deniedPerm.error.canOpenSettings &&
      !requestedWhenPermanent,
  );

  const servicesOff = await getCurrentDeviceLocation({
    promptEnableServices: false,
    locationModule: createMockLocationModule({
      hasServicesEnabledAsync: async () => false,
    }),
  });
  assert(
    'GPS non-aktif menghasilkan SERVICES_DISABLED dengan canOpenSettings=true',
    !servicesOff.ok &&
      servicesOff.error.code === 'SERVICES_DISABLED' &&
      servicesOff.error.canOpenSettings,
  );

  const unavailableLoc = await getCurrentDeviceLocation({
    allowLastKnownFallback: false,
    locationModule: createMockLocationModule({
      getCurrentPositionAsync: async () => {
        throw new Error('Current location is unavailable');
      },
    }),
  });
  assert(
    'Kegagalan pengambilan posisi tanpa fallback menghasilkan LOCATION_UNAVAILABLE',
    !unavailableLoc.ok && unavailableLoc.error.code === 'LOCATION_UNAVAILABLE',
  );

  const recoveredLastKnown = await getCurrentDeviceLocation({
    allowLastKnownFallback: true,
    locationModule: createMockLocationModule({
      getCurrentPositionAsync: async () => {
        throw new Error('Location request timed out');
      },
      getLastKnownPositionAsync: async () => ({
        coords: { latitude: -7.771, longitude: 110.378, accuracy: 20 },
        timestamp: 1700000000000,
      }),
    }),
  });
  assert(
    'Fallback getLastKnownPositionAsync memulihkan koordinat saat timeout jika diaktifkan',
    recoveredLastKnown.ok && recoveredLastKnown.data.latitude === -7.771,
  );

  const unsupportedRes = await getCurrentDeviceLocation({
    locationModule: null,
  });
  assert(
    'Modul lokasi null mengembalikan PLATFORM_UNSUPPORTED',
    !unsupportedRes.ok && unsupportedRes.error.code === 'PLATFORM_UNSUPPORTED',
  );

  // Uji cleanup watchDeviceLocation (sebelum permission selesai & saat watchPositionAsync sedang pending)
  let watchStartedEarly = false;
  const stopImmediate = watchDeviceLocation(
    () => undefined,
    () => undefined,
    {
      locationModule: createMockLocationModule({
        watchPositionAsync: async () => {
          watchStartedEarly = true;
          return { remove: () => undefined };
        },
      }),
    },
  );
  stopImmediate();
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert(
    'watchDeviceLocation membatalkan subscribe sebelum watchPositionAsync dipanggil jika cleanup cepat',
    !watchStartedEarly,
  );

  let removedLate = false;
  let watchedCount = 0;
  let notifyWatchStarted: (() => void) | null = null;
  const watchStartedPromise = new Promise<void>((resolve) => {
    notifyWatchStarted = resolve;
  });
  const stopDuringSubscribe = watchDeviceLocation(
    () => {
      watchedCount += 1;
    },
    () => undefined,
    {
      locationModule: createMockLocationModule({
        watchPositionAsync: async () => {
          notifyWatchStarted?.();
          await new Promise((resolve) => setTimeout(resolve, 20));
          return {
            remove: () => {
              removedLate = true;
            },
          };
        },
      }),
    },
  );
  await watchStartedPromise;
  stopDuringSubscribe();
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert(
    'watchDeviceLocation memanggil remove() otomatis bila cleanup dipanggil saat watchPositionAsync pending',
    removedLate && watchedCount === 0,
  );

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  return { passed, failed, results };
}
