import {
  getAuth as getWebAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import { getApp } from './firebase-app.web';

export function getAuth(app?: any): Auth {
  const targetApp = app ?? getApp();
  return getWebAuth(targetApp);
}

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
};

export type FirebaseAuthInstance = ReturnType<typeof getAuth>;
export default getAuth;
