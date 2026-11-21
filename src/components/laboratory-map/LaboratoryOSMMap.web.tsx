import React, { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import type { LaboratoryOSMMapProps } from './LaboratoryOSMMap.types';

/**
 * Leaflet needs the browser window/document APIs. Load its implementation
 * only after this component mounts in the browser to avoid Expo web SSR errors.
 */
const LaboratoryOSMMap: React.FC<LaboratoryOSMMapProps> = (props) => {
  const [MapView, setMapView] = useState<ComponentType<LaboratoryOSMMapProps> | null>(null);

  useEffect(() => {
    let active = true;

    import('./LaboratoryOSMMap.web.client')
      .then((module) => {
        if (active) setMapView(() => module.default);
      })
      .catch((error) => {
        console.error('Gagal memuat OpenStreetMap:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!MapView) {
    return (
      <div
        style={{
          width: '100%',
          height: 260,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f1f5f9',
          borderRadius: 12,
        }}
      >
        Memuat peta OpenStreetMap...
      </div>
    );
  }

  return <MapView {...props} />;
};

export default LaboratoryOSMMap;
