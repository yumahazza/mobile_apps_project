import { useEffect, useState } from 'react';
import type { Laboratory } from '@/types/laboratory';
import { subscribeToLaboratories } from '@/services/laboratoryService';

interface LaboratoryState {
  laboratories: Laboratory[];
  loading: boolean;
  error: string | null;
}

/**
 * Langganan real-time koleksi `laboratories` (service milik Yuma).
 * Dipakai bersama oleh Manajemen Lab, Jadwal, Presensi, dan Peta Birela.
 * `_assistantUid` hanya dipertahankan agar pemanggil lama
 * (`useLaboratories(isAssistant ? uid : undefined)`) tetap valid; tidak memengaruhi langganan.
 */
export function useLaboratories(_assistantUid?: string): LaboratoryState {
  const [state, setState] = useState<LaboratoryState>({
    laboratories: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = subscribeToLaboratories(
      laboratories =>
        setState({ laboratories, loading: false, error: null }),
      message =>
        setState(previous => ({
          ...previous,
          loading: false,
          error: message,
        })),
    );

    return unsubscribe;
  }, []);

  return state;
}
