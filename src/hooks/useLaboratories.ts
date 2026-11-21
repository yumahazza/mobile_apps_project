import { useEffect, useState } from 'react';
import {
  LaboratoryLocation,
  subscribeToLaboratories,
} from '@/services/laboratoryMapService';

interface LaboratoryState {
  laboratories: LaboratoryLocation[];
  loading: boolean;
  error: string | null;
}

export function useLaboratories(): LaboratoryState {
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
