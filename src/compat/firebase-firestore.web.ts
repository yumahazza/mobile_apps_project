import {
  getFirestore as getWebFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  Timestamp,
  FieldValue,
  type Firestore,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getApp } from './firebase-app.web';

export function getFirestore(app?: any): Firestore {
  const targetApp = app ?? getApp();
  return getWebFirestore(targetApp);
}

export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  Timestamp,
  FieldValue,
  type Firestore,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
};

export default getFirestore;
