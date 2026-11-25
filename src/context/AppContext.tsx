/**
 * Global App Context
 * SRS-INF-003: Global State Context (AppContext) to manage active role,
 * users, schedules, session status, and attendance logs.
 */

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useRef,
  useEffect,
  ReactNode,
} from 'react';

import { Platform } from 'react-native';

import {
  getAuth,
  onAuthStateChanged,
} from '@react-native-firebase/auth';

import {
  getUserProfile,
  signOut,
} from '@/services/authService';
import {
  removeUserFcmToken,
  setupUserPushNotifications,
  type PushNotificationSessionHandle,
} from '@/services/pushNotificationService';
import type {
  PushNotificationPayload,
  PushRegistrationState,
} from '@/types/notification';

import {
  User,
  DUMMY_USERS,
  DEFAULT_USER,
  UserRole,
} from '@/data/users';

import {
  Schedule,
  AttendanceRecord,
  SessionStatus,
  DUMMY_SCHEDULES,
  DUMMY_ATTENDANCE_LOGS,
} from '@/data/schedules';

export interface AttendanceResult {
  success: boolean;
  message: string;
  timestamp?: string;
  record?: AttendanceRecord;
}

export interface AppContextType {
  // Authentication
  authLoading: boolean;
  authError: string | null;
  firebaseUnavailable: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;

  // User & Role
  activeUser: User;
  users: User[];
  activeRole: UserRole;
  setActiveUser: (user: User) => void;
  switchUser: (userId: string) => void;

  // Schedules
  schedules: Schedule[];
  activeScheduleId: string;
  activeSchedule: Schedule | undefined;
  setActiveScheduleId: (id: string) => void;

  // Session Control
  openSession: (scheduleId: string) => void;
  closeSession: (scheduleId: string) => void;
  updateSessionStatus: (
    scheduleId: string,
    status: SessionStatus
  ) => void;

  // Attendance
  attendanceLogs: AttendanceRecord[];
  submitAttendance: (
    scheduleId: string,
    student?: User
  ) => AttendanceResult;
  hasStudentAttended: (
    scheduleId: string,
    studentId: string
  ) => boolean;
  getStudentAttendanceForSchedule: (
    scheduleId: string,
    studentId: string
  ) => AttendanceRecord | undefined;
  getAttendanceForSchedule: (
    scheduleId: string
  ) => AttendanceRecord[];
  getStudentHistory: (
    studentId: string
  ) => (AttendanceRecord & { schedule?: Schedule })[];

  // Push Notifications (FCM - Sprint 3 Fritz)
  pushRegistration: PushRegistrationState;
  latestForegroundNotification: PushNotificationPayload | null;
  pendingNotificationPayload: PushNotificationPayload | null;
  refreshPushRegistration: () => void;
  dismissForegroundNotification: () => void;
  clearPendingNotificationPayload: () => void;

  // Reset
  resetDemoData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Jumlah percobaan untuk membaca profil yang baru dibuat.
const PROFILE_MAX_ATTEMPTS = 5;
const PROFILE_RETRY_DELAY_MS = 400;

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function loadUserProfileWithRetry(
  uid: string,
): Promise<User> {
  let lastError: unknown;

  for (
    let attempt = 0;
    attempt < PROFILE_MAX_ATTEMPTS;
    attempt++
  ) {
    try {
      return await getUserProfile(uid);
    } catch (error) {
      lastError = error;

      // Retry hanya jika profil belum tersedia.
      const message =
        error instanceof Error ? error.message : '';

      if (
        !message.includes('Profil pengguna belum ditemukan') ||
        attempt === PROFILE_MAX_ATTEMPTS - 1
      ) {
        throw error;
      }

      await wait(PROFILE_RETRY_DELAY_MS);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Gagal memuat profil pengguna.');
}

function getCurrentTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${hours}:${minutes}:${seconds} WIB`;
}

function getCurrentDate(): string {
  const now = new Date();
  const day = now.getDate();

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];

  return `${day} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Authentication state
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [firebaseUnavailable, setFirebaseUnavailable] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // User state
  const [activeUser, setActiveUser] = useState<User>(DEFAULT_USER);

  // Token untuk mengabaikan hasil async dari sesi auth lama.
  const authRequestIdRef = useRef(0);

  // Push Notification (FCM) state
  const [pushRegistration, setPushRegistration] = useState<PushRegistrationState>({
    permissionStatus: 'not_determined',
    fcmToken: null,
    tokenSynced: false,
    error: null,
    isRegistering: false,
  });
  const [pushRetryCount, setPushRetryCount] = useState(0);
  const [latestForegroundNotification, setLatestForegroundNotification] =
    useState<PushNotificationPayload | null>(null);
  const [pendingNotificationPayload, setPendingNotificationPayload] =
    useState<PushNotificationPayload | null>(null);
  const pushSessionRef = useRef<PushNotificationSessionHandle | null>(null);

  // Existing local demo data
  const [schedules, setSchedules] =
    useState<Schedule[]>(DUMMY_SCHEDULES);

  const [attendanceLogs, setAttendanceLogs] =
    useState<AttendanceRecord[]>(DUMMY_ATTENDANCE_LOGS);

  const attendanceKeysRef = useRef<Set<string>>(
    new Set(
      DUMMY_ATTENDANCE_LOGS.map(
        (log) => `${log.scheduleId}:${log.studentId}`
      )
    )
  );

  const [activeScheduleId, setActiveScheduleId] =
    useState<string>('sch-1');

  const activeRole: UserRole = activeUser.role;

  const activeSchedule = useMemo(
    () =>
      schedules.find((schedule) => schedule.id === activeScheduleId) ||
      schedules[0],
    [schedules, activeScheduleId]
  );

  // Listen to Firebase Authentication changes
  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const initAuthListener = async () => {
      // Hindari pemanggilan sinkron setState langsung di body useEffect.
      await Promise.resolve();
      if (!isMounted) return;

      try {
        const auth = getAuth();
        const authUnsubscribe = onAuthStateChanged(
          auth,
          async (firebaseUser) => {
            if (!isMounted) return;

            const requestId = ++authRequestIdRef.current;

            setAuthError(null);
            setFirebaseUnavailable(false);
            setAuthLoading(true);

            // Jangan pertahankan akses akun sebelumnya
            // ketika Firebase sedang memuat akun yang berbeda.
            setIsAuthenticated(false);
            setActiveUser(DEFAULT_USER);

            if (!firebaseUser) {
              setAuthLoading(false);
              return;
            }

            try {
              const profile = await loadUserProfileWithRetry(
                firebaseUser.uid,
              );

              if (
                !isMounted ||
                requestId !== authRequestIdRef.current
              ) {
                return;
              }

              setActiveUser(profile);
              setIsAuthenticated(true);
            } catch (error) {
              if (
                !isMounted ||
                requestId !== authRequestIdRef.current
              ) {
                return;
              }

              setActiveUser(DEFAULT_USER);
              setIsAuthenticated(false);
              setAuthError(
                error instanceof Error
                  ? error.message
                  : 'Gagal memuat profil pengguna.'
              );
            } finally {
              if (
                isMounted &&
                requestId === authRequestIdRef.current
              ) {
                setAuthLoading(false);
              }
            }
          }
        );

        if (!isMounted) {
          authUnsubscribe();
          return;
        }
        unsubscribe = authUnsubscribe;
      } catch (error) {
        if (!isMounted) return;

        const message =
          error instanceof Error ? error.message : '';
        const isMissingNativeApp =
          message.includes("No Firebase App '[DEFAULT]'") ||
          message.includes('RNFBAppModule') ||
          message.includes('not installed');

        setActiveUser(DEFAULT_USER);
        setIsAuthenticated(false);
        setFirebaseUnavailable(true);
        setAuthError(
          isMissingNativeApp
            ? 'Modul native Firebase belum aktif (Expo Go tidak mendukung @react-native-firebase).'
            : message || 'Gagal menginisialisasi Firebase Authentication.'
        );
        setAuthLoading(false);
      }
    };

    void initAuthListener();

    return () => {
      isMounted = false;
      authRequestIdRef.current += 1;
      unsubscribe?.();
    };
  }, []);

  // Sinkronisasi izin notifikasi, token FCM, dan listener foreground/background untuk akun aktif
  useEffect(() => {
    if (!isAuthenticated || !activeUser.id) {
      pushSessionRef.current?.unsubscribe();
      pushSessionRef.current = null;
      return undefined;
    }

    const session = setupUserPushNotifications(activeUser.id, {
      onStateChange: (nextState) => {
        setPushRegistration(nextState);
      },
      onForegroundMessage: (payload) => {
        setLatestForegroundNotification(payload);
      },
      onNotificationOpened: (payload) => {
        setPendingNotificationPayload(payload);
      },
    });

    pushSessionRef.current = session;

    return () => {
      session.unsubscribe();
      if (pushSessionRef.current === session) {
        pushSessionRef.current = null;
      }
    };
  }, [isAuthenticated, activeUser.id, pushRetryCount]);

  const effectivePushRegistration: PushRegistrationState =
    isAuthenticated && activeUser.id
      ? pushRegistration
      : {
          permissionStatus: 'not_determined',
          fcmToken: null,
          tokenSynced: false,
          error: null,
          isRegistering: false,
        };
  const effectiveLatestForegroundNotification =
    isAuthenticated && activeUser.id ? latestForegroundNotification : null;
  const effectivePendingNotificationPayload =
    isAuthenticated && activeUser.id ? pendingNotificationPayload : null;

  const refreshPushRegistration = (): void => {
    setPushRetryCount((prev) => prev + 1);
  };

  const dismissForegroundNotification = (): void => {
    setLatestForegroundNotification(null);
  };

  const clearPendingNotificationPayload = (): void => {
    setPendingNotificationPayload(null);
  };

  // Logout from Firebase
  const logout = async (): Promise<void> => {
    setAuthError(null);

    try {
      const activeToken =
        pushSessionRef.current?.getCurrentToken() ?? pushRegistration.fcmToken;
      if (isAuthenticated && activeUser.id && activeToken) {
        await removeUserFcmToken(activeUser.id, activeToken);
      }

      pushSessionRef.current?.unsubscribe();
      pushSessionRef.current = null;
      setLatestForegroundNotification(null);
      setPendingNotificationPayload(null);

      await signOut();
      // onAuthStateChanged will update the authentication state.
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Gagal logout. Silakan coba lagi.';

      setAuthError(message);
      throw error;
    }
  };

  // Demo role switching is available only when not authenticated.
  const switchUser = (userId: string): void => {
    if (isAuthenticated) return;

    const targetUser = DUMMY_USERS.find(
      (user) => user.id === userId
    );

    if (targetUser) {
      setActiveUser(targetUser);
    }
  };

  // Session control
  const updateSessionStatus = (
    scheduleId: string,
    status: SessionStatus
  ): void => {
    setSchedules((previous) =>
      previous.map((schedule) =>
        schedule.id === scheduleId
          ? { ...schedule, status }
          : schedule
      )
    );
  };

  const openSession = (scheduleId: string): void => {
    updateSessionStatus(scheduleId, 'DIBUKA');
  };

  const closeSession = (scheduleId: string): void => {
    updateSessionStatus(scheduleId, 'SELESAI');
  };

  // Attendance helpers
  const hasStudentAttended = (
    scheduleId: string,
    studentId: string
  ): boolean => {
    return attendanceLogs.some(
      (log) =>
        log.scheduleId === scheduleId &&
        log.studentId === studentId
    );
  };

  const getStudentAttendanceForSchedule = (
    scheduleId: string,
    studentId: string
  ): AttendanceRecord | undefined => {
    return attendanceLogs.find(
      (log) =>
        log.scheduleId === scheduleId &&
        log.studentId === studentId
    );
  };

  const getAttendanceForSchedule = (
    scheduleId: string
  ): AttendanceRecord[] => {
    return attendanceLogs.filter(
      (log) => log.scheduleId === scheduleId
    );
  };

  const getStudentHistory = (
    studentId: string
  ): (AttendanceRecord & { schedule?: Schedule })[] => {
    const studentLogs = attendanceLogs.filter(
      (log) => log.studentId === studentId
    );

    return studentLogs.map((log) => ({
      ...log,
      schedule: schedules.find(
        (schedule) => schedule.id === log.scheduleId
      ),
    }));
  };

  // Submit attendance (currently uses local demo state)
  const submitAttendance = (
    scheduleId: string,
    student: User = activeUser
  ): AttendanceResult => {
    const targetSchedule = schedules.find(
      (schedule) => schedule.id === scheduleId
    );

    if (!targetSchedule) {
      return {
        success: false,
        message: 'Jadwal praktikum tidak ditemukan.',
      };
    }

    // SRS-VAL-001: Validate session status
    if (targetSchedule.status === 'BELUM_DIBUKA') {
      return {
        success: false,
        message: 'Presensi belum dibuka oleh asisten praktikum.',
      };
    }

    if (targetSchedule.status === 'SELESAI') {
      return {
        success: false,
        message:
          'Sesi praktikum telah ditutup. Presensi tidak dapat dilakukan lagi.',
      };
    }

    // SRS-VAL-002: Prevent duplicate attendance
    const attendanceKey = `${scheduleId}:${student.id}`;

    if (
      attendanceKeysRef.current.has(attendanceKey) ||
      hasStudentAttended(scheduleId, student.id)
    ) {
      return {
        success: false,
        message:
          'Anda sudah melakukan presensi pada sesi ini sebelumnya.',
      };
    }

    attendanceKeysRef.current.add(attendanceKey);

    const timestamp = getCurrentTimestamp();
    const date = getCurrentDate();

    const newRecord: AttendanceRecord = {
      id: `att-${Date.now()}-${student.id}`,
      scheduleId,
      studentId: student.id,
      studentName: student.name,
      nim: student.nim || '-',
      timestamp,
      date,
      status: 'Hadir',
    };

    setAttendanceLogs((previous) => [
      newRecord,
      ...previous,
    ]);

    return {
      success: true,
      message: `Presensi Berhasil! Waktu: ${timestamp}`,
      timestamp,
      record: newRecord,
    };
  };

  // Reset local demo data
  const resetDemoData = (): void => {
    if (!isAuthenticated) {
      setActiveUser(DEFAULT_USER);
    }

    setSchedules(DUMMY_SCHEDULES);
    setAttendanceLogs(DUMMY_ATTENDANCE_LOGS);

    attendanceKeysRef.current = new Set(
      DUMMY_ATTENDANCE_LOGS.map(
        (log) => `${log.scheduleId}:${log.studentId}`
      )
    );

    setActiveScheduleId('sch-1');
  };

  return (
    <AppContext.Provider
      value={{
        // Authentication
        authLoading,
        authError,
        firebaseUnavailable,
        isAuthenticated,
        logout,

        // User & Role
        activeUser,
        users: DUMMY_USERS,
        activeRole,
        setActiveUser,
        switchUser,

        // Schedules
        schedules,
        activeScheduleId,
        activeSchedule,
        setActiveScheduleId,

        // Session Control
        openSession,
        closeSession,
        updateSessionStatus,

        // Attendance
        attendanceLogs,
        submitAttendance,
        hasStudentAttended,
        getStudentAttendanceForSchedule,
        getAttendanceForSchedule,
        getStudentHistory,

        // Push Notifications (FCM - Sprint 3 Fritz)
        pushRegistration: effectivePushRegistration,
        latestForegroundNotification: effectiveLatestForegroundNotification,
        pendingNotificationPayload: effectivePendingNotificationPayload,
        refreshPushRegistration,
        dismissForegroundNotification,
        clearPendingNotificationPayload,

        // Reset
        resetDemoData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }

  return context;
};

export default AppContext;
