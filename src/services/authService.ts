
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth';

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';

import type { User, UserRole } from '@/data/users';

interface RegisterProfile {
  name: string;
  nim?: string;
  department?: string;
}

/**
 * Registrasi akun baru.
 * Registrasi publik hanya boleh membuat akun student.
 */
export async function registerWithEmail(
  email: string,
  password: string,
  profile: RegisterProfile,
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = profile.name.trim();

  if (!normalizedName) {
    throw new Error('Nama wajib diisi.');
  }

  const credential = await createUserWithEmailAndPassword(
    getAuth(),
    normalizedEmail,
    password,
  );

  const userRef = doc(
    collection(getFirestore(), 'users'),
    credential.user.uid,
  );

  await setDoc(userRef, {
    name: normalizedName,
    email: credential.user.email ?? normalizedEmail,
    role: 'student',
    ...(profile.nim?.trim()
      ? { nim: profile.nim.trim() }
      : {}),
    ...(profile.department?.trim()
      ? { department: profile.department.trim() }
      : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Login dengan email dan password.
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<void> {
  await signInWithEmailAndPassword(
    getAuth(),
    email.trim().toLowerCase(),
    password,
  );
}

/**
 * Logout dari Firebase Authentication.
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(getAuth());
}

/**
 * Mengambil profil pengguna berdasarkan Firebase UID.
 */
export async function getUserProfile(uid: string): Promise<User> {
  const userRef = doc(
    collection(getFirestore(), 'users'),
    uid,
  );

  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    throw new Error(
      'Profil pengguna belum ditemukan di Firestore.',
    );
  }

  const data = snapshot.data();

  if (
    typeof data.name !== 'string' ||
    typeof data.email !== 'string' ||
    (data.role !== 'assistant' && data.role !== 'student')
  ) {
    throw new Error('Data profil pengguna tidak valid.');
  }

  const role: UserRole = data.role;

  return {
    id: snapshot.id,
    name: data.name,
    email: data.email,
    role,
    ...(typeof data.nim === 'string'
      ? { nim: data.nim }
      : {}),
    ...(typeof data.department === 'string'
      ? { department: data.department }
      : {}),
  };
}
