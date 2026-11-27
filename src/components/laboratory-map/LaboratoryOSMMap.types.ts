import type { LaboratoryLocation } from '@/services/laboratoryMapService';
import type { DeviceCoordinates } from '@/services/mapLocationAdapter';

export interface PickedCoordinate {
  latitude: number;
  longitude: number;
}

export interface LaboratoryOSMMapProps {
  laboratories: LaboratoryLocation[];
  selectedLaboratoryId: string | null;
  deviceLocation: DeviceCoordinates | null;
  initialCenter: [number, number];
  /** Naikkan nilainya untuk memusatkan peta ke posisi perangkat. */
  deviceFocusToken?: number;
  /** Naikkan nilainya untuk menampilkan semua laboratorium (dan posisi perangkat). */
  fitAllToken?: number;
  /** Mode atur posisi: ketuk peta untuk memilih koordinat baru laboratorium. */
  pickMode?: boolean;
  pickedLocation?: PickedCoordinate | null;
  onPickLocation?: (coordinate: PickedCoordinate) => void;
  onSelectLaboratory: (laboratory: LaboratoryLocation) => void;
}
