/**
 * Lintang — Hook Validasi Lokasi & Kelayakan Presensi Mahasiswa (Sprint 3)
 *
 * Mengintegrasikan pengambilan lokasi GPS, penentuan laboratorium, perhitungan
 * jarak Haversine, dan validasi radius presensi untuk StudentAttendanceScreen.
 */
import { useCallback, useEffect, useState } from 'react';
import type { LaboratoryLocation } from '@/services/laboratoryMapService';
import type { PracticumSchedule } from '@/services/practicumScheduleService';
import {
  evaluateAttendanceEligibility,
  getDeviceAttendanceLocation,
  matchScheduleToLaboratory,
  validateAttendanceRadius,
  type AttendanceEligibilityResult,
  type DeviceLocationResult,
  type LaboratoryMatchResult,
  type RadiusValidationResult,
} from '@/services/attendanceLocationService';

export interface UseStudentAttendanceLocationProps {
  schedule: PracticumSchedule | null;
  laboratories: LaboratoryLocation[];
  isEnrolled: boolean;
  hasAttendanceRecord: boolean;
}

export interface UseStudentAttendanceLocationState {
  checking: boolean;
  deviceLocationResult: DeviceLocationResult | null;
  labMatchResult: LaboratoryMatchResult | null;
  matchedLaboratory: LaboratoryLocation | null;
  radiusValidation: RadiusValidationResult | null;
  eligibility: AttendanceEligibilityResult;
  lastCheckedAt: Date | null;
  checkLocation: () => Promise<void>;
}

export function useStudentAttendanceLocation({
  schedule,
  laboratories,
  isEnrolled,
  hasAttendanceRecord,
}: UseStudentAttendanceLocationProps): UseStudentAttendanceLocationState {
  const [checking, setChecking] = useState<boolean>(true);
  const [deviceLocationResult, setDeviceLocationResult] =
    useState<DeviceLocationResult | null>(null);
  const [labMatchResult, setLabMatchResult] =
    useState<LaboratoryMatchResult | null>(null);
  const [radiusValidation, setRadiusValidation] =
    useState<RadiusValidationResult | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const checkLocation = useCallback(async () => {
    if (!schedule) {
      setChecking(false);
      return;
    }

    setChecking(true);

    // 1. Cocokkan laboratorium dengan jadwal secara fail-closed
    const match = matchScheduleToLaboratory(
      {
        room: schedule.room,
        laboratoryId: (schedule as unknown as { laboratoryId?: string }).laboratoryId,
      },
      laboratories,
    );
    setLabMatchResult(match);

    // 2. Ambil lokasi perangkat saat ini
    const locResult = await getDeviceAttendanceLocation();
    setDeviceLocationResult(locResult);
    setLastCheckedAt(new Date());

    // 3. Jika lab cocok dan lokasi didapat, validasi radius
    if (match.laboratory && locResult.success && locResult.coordinates) {
      const radiusResult = validateAttendanceRadius(
        locResult.coordinates.latitude,
        locResult.coordinates.longitude,
        match.laboratory.latitude,
        match.laboratory.longitude,
        match.laboratory.radius,
        locResult.coordinates.accuracy,
      );
      setRadiusValidation(radiusResult);
    } else {
      setRadiusValidation(null);
    }

    setChecking(false);
  }, [schedule, laboratories]);

  // Jalankan pemeriksaan otomatis saat jadwal atau daftar lab siap
  useEffect(() => {
    if (schedule && laboratories.length > 0) {
      checkLocation();
    } else if (schedule && laboratories.length === 0) {
      // Tunggu laboratorium selesai dimuat
      const timer = setTimeout(() => {
        checkLocation();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [schedule?.id, laboratories.length]);

  const matchedLaboratory = labMatchResult?.laboratory ?? null;

  const eligibility = evaluateAttendanceEligibility({
    sessionStatus: schedule?.status ?? 'BELUM_DIBUKA',
    isEnrolled,
    hasAttendanceRecord,
    isLocationChecking: checking,
    radiusValidation,
    laboratory: matchedLaboratory,
  });

  return {
    checking,
    deviceLocationResult,
    labMatchResult,
    matchedLaboratory,
    radiusValidation,
    eligibility,
    lastCheckedAt,
    checkLocation,
  };
}
