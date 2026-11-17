import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, type Firestore } from '@react-native-firebase/firestore';

export type FirebaseAuthInstance = ReturnType<typeof getAuth>;

/**
 * Mengambil instance Firestore secara lazy saat fungsi dipanggil di runtime,
 * bukan pada top-level module load agar aman terhadap SSR Expo Router.
 */
export function getFirestoreDb(): Firestore {
  return getFirestore();
}

/**
 * Mengambil instance Firestore secara aman (mengembalikan null jika
 * aplikasi Firebase default belum terinisialisasi, mis. di Web / Expo Go).
 */
export function getSafeFirestoreDb(): Firestore | null {
  try {
    return getFirestore();
  } catch {
    return null;
  }
}

/**
 * Mengambil instance Firebase Auth secara aman (mengembalikan null jika
 * aplikasi Firebase default belum terinisialisasi).
 */
export function getSafeFirebaseAuth(): FirebaseAuthInstance | null {
  try {
    return getAuth();
  } catch {
    return null;
  }
}

/**
 * Mengambil UID pengguna aktif dari Firebase Auth secara aman.
 */
export function getSafeAuthUid(): string | null {
  return getSafeFirebaseAuth()?.currentUser?.uid ?? null;
}
