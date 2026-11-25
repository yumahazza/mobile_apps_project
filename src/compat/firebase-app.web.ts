import { initializeApp, getApps, getApp as getWebApp, type FirebaseApp } from 'firebase/app';

export const firebaseConfig = {
  apiKey: 'AIzaSyDYnqTKZApWwiU4iDPQAufUk_ko0YIxHEQ',
  authDomain: 'ppk-praktikum-2a6ab.firebaseapp.com',
  projectId: 'ppk-praktikum-2a6ab',
  storageBucket: 'ppk-praktikum-2a6ab.firebasestorage.app',
  messagingSenderId: '164607713769',
  appId: '1:164607713769:android:ad2820d2fa053d5c9eab78',
};

export function getApp(name?: string): FirebaseApp {
  if (name) {
    return getWebApp(name);
  }
  return getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
}

export function initializeWebFirebase(): FirebaseApp {
  return getApp();
}

export { initializeApp, getApps, type FirebaseApp };
export default getApp;
