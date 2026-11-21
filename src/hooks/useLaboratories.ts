/**
 * Yuma — Hook Real-time Data Laboratorium (Sprint 3)
 * Memantau koleksi `laboratories` dari Cloud Firestore via onSnapshot.
 */
import { useEffect, useState } from 'react';
import { subscribeToLaboratories } from '@/services/laboratoryService';
import type { Laboratory } from '@/types/laboratory';

interface LaboratoriesState {
  laboratories: Laboratory[];
  loading: boolean;
  error: string | null;
}

export function useLaboratories(uid?: string): LaboratoriesState {
  const activeUid = uid?.trim() || '';
  const [state, setState] = useState<{
    uid: string;
    laboratories: Laboratory[];
    error: string | null;
  }>({
    uid: '',
    laboratories: [],
    error: null,
  });

  useEffect(() => {
    if (!activeUid) {
      return undefined;
    }

    const targetUid = activeUid;
    const unsubscribe = subscribeToLaboratories(
      (laboratories) => {
        setState({ uid: targetUid, laboratories, error: null });
      },
      (message) => {
        setState({ uid: targetUid, laboratories: [], error: message });
      },
    );

    return () => {
      unsubscribe();
    };
  }, [activeUid]);

  if (!activeUid) {
    return {
      laboratories: [],
      loading: false,
      error: null,
    };
  }

  return {
    laboratories: state.uid === activeUid ? state.laboratories : [],
    loading: state.uid !== activeUid,
    error: state.uid === activeUid ? state.error : null,
  };
}
