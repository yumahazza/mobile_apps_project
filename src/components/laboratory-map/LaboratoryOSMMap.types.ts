import type { LaboratoryLocation } from '@/services/laboratoryMapService';
import type { DeviceCoordinates } from '@/services/mapLocationAdapter';

export interface LaboratoryOSMMapProps {
  laboratories: LaboratoryLocation[];
  selectedLaboratoryId: string | null;
  deviceLocation: DeviceCoordinates | null;
  initialCenter: [number, number];
  onSelectLaboratory: (laboratory: LaboratoryLocation) => void;
}
