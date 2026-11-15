/**
 * Type declarations untuk React Native Firebase (Modular v27).
 * Menyediakan type annotations lengkap untuk auth dan firestore modular SDK.
 */
declare module '@react-native-firebase/auth' {
  export interface FirebaseAuthUser {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
  }

  export interface FirebaseAuthInstance {
    currentUser: FirebaseAuthUser | null;
    onAuthStateChanged: (
      listener: (user: FirebaseAuthUser | null) => void,
    ) => () => void;
    signOut?: () => Promise<void>;
  }

  export function getAuth(): FirebaseAuthInstance;
  export default function auth(): FirebaseAuthInstance;

  export namespace FirebaseAuthTypes {
    export type User = FirebaseAuthUser;
    export type Auth = FirebaseAuthInstance;
  }
}

declare module '@react-native-firebase/firestore' {
  export namespace FirebaseFirestoreTypes {
    export interface Timestamp {
      seconds: number;
      nanoseconds: number;
      toDate: () => Date;
      toMillis: () => number;
    }

    export interface FieldValue {
      _methodName?: string;
    }

    export interface DocumentReference<T = any> {
      id: string;
      path: string;
      _type?: T;
    }

    export interface CollectionReference<T = any> {
      id: string;
      path: string;
      _type?: T;
    }

    export interface QueryDocumentSnapshot<T = Record<string, unknown>> {
      id: string;
      data: () => T;
      exists: () => boolean;
    }

    export interface QuerySnapshot<T = Record<string, unknown>> {
      docs: QueryDocumentSnapshot<T>[];
      size: number;
      empty: boolean;
    }

    export interface DocumentSnapshot<T = Record<string, unknown>> {
      id: string;
      exists: () => boolean;
      data: () => T | undefined;
    }

    export interface Transaction {
      get<T = Record<string, unknown>>(
        ref: DocumentReference<T> | any,
      ): Promise<DocumentSnapshot<T>>;
      set<T = any>(
        ref: DocumentReference<T> | any,
        data: T,
        options?: any,
      ): Transaction;
      update(ref: DocumentReference<any> | any, data: any): Transaction;
      delete(ref: DocumentReference<any> | any): Transaction;
    }

    export interface Firestore {
      collection: (path: string) => any;
      doc: (path: string) => any;
    }
  }

  export function getFirestore(): FirebaseFirestoreTypes.Firestore;
  export function collection(
    firestore: any,
    ...pathSegments: string[]
  ): FirebaseFirestoreTypes.CollectionReference<any>;
  export function doc(
    firestoreOrCollection: any,
    ...pathSegments: string[]
  ): FirebaseFirestoreTypes.DocumentReference<any>;
  export function getDoc<T = Record<string, unknown>>(
    docRef: any,
  ): Promise<FirebaseFirestoreTypes.DocumentSnapshot<T>>;
  export function getDocs<T = Record<string, unknown>>(
    queryOrCollection: any,
  ): Promise<FirebaseFirestoreTypes.QuerySnapshot<T>>;
  export function addDoc<T = any>(
    collectionRef: any,
    data: T,
  ): Promise<FirebaseFirestoreTypes.DocumentReference<T>>;
  export function updateDoc(docRef: any, data: any): Promise<void>;
  export function deleteDoc(docRef: any): Promise<void>;
  export function query(collectionRef: any, ...queryConstraints: any[]): any;
  export function where(fieldPath: string, opStr: string, value: any): any;
  export function onSnapshot<T = Record<string, unknown>>(
    target: any,
    onNext: (
      snapshot: FirebaseFirestoreTypes.QuerySnapshot<T> &
        FirebaseFirestoreTypes.DocumentSnapshot<T>,
    ) => void,
    onError?: (error: any) => void,
  ): () => void;
  export function runTransaction<T>(
    firestore: any,
    updateFunction: (
      transaction: FirebaseFirestoreTypes.Transaction,
    ) => Promise<T>,
  ): Promise<T>;
  export function serverTimestamp(): FirebaseFirestoreTypes.FieldValue;

  export default function firestore(): FirebaseFirestoreTypes.Firestore;
}
