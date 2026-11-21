import React, { useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type { LaboratoryOSMMapProps } from './LaboratoryOSMMap.types';

const labIcon = (selected: boolean) => L.divIcon({
  className: '',
  html: `<div style="width:${selected ? 22 : 18}px;height:${selected ? 22 : 18}px;border-radius:50%;background:${selected ? '#2563EB' : '#D97706'};border:3px solid white;box-shadow:0 1px 5px #555"></div>`,
  iconSize: selected ? [28, 28] : [24, 24],
  iconAnchor: selected ? [14, 14] : [12, 12],
});

const userIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#2563EB;border:3px solid white;box-shadow:0 0 0 7px #2563EB33"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function MapCenter({ center, selectedLaboratoryId, laboratories }: Pick<LaboratoryOSMMapProps, 'selectedLaboratoryId' | 'laboratories'> & { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const selected = laboratories.find(item => item.id === selectedLaboratoryId);
    map.setView(selected ? [selected.latitude, selected.longitude] : center, selected ? 17 : 14, { animate: true });
  }, [map, center, selectedLaboratoryId, laboratories]);
  return null;
}

const LaboratoryOSMMap: React.FC<LaboratoryOSMMapProps> = ({
  laboratories,
  selectedLaboratoryId,
  deviceLocation,
  initialCenter,
  onSelectLaboratory,
}) => (
  <div style={{ width: '100%', height: '100%', minHeight: 260, overflow: 'hidden', borderRadius: 12 }}>
    <MapContainer center={initialCenter} zoom={14} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <MapCenter center={initialCenter} selectedLaboratoryId={selectedLaboratoryId} laboratories={laboratories} />
      {laboratories.map(laboratory => (
        <Marker
          key={laboratory.id}
          position={[laboratory.latitude, laboratory.longitude]}
          icon={labIcon(laboratory.id === selectedLaboratoryId)}
          eventHandlers={{ click: () => onSelectLaboratory(laboratory) }}
        >
          <Popup>
            <strong>{laboratory.name}</strong><br />
            {laboratory.building}<br />
            Lantai {laboratory.floor || '-'}<br />
            <small>Klik marker untuk melihat aktivitas praktikum.</small>
          </Popup>
        </Marker>
      ))}
      {deviceLocation && (
        <Marker position={[deviceLocation.latitude, deviceLocation.longitude]} icon={userIcon}>
          <Popup>Lokasi Anda</Popup>
        </Marker>
      )}
    </MapContainer>
  </div>
);

export default LaboratoryOSMMap;
