import React, { useEffect, useRef } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type { LaboratoryOSMMapProps } from './LaboratoryOSMMap.types';

const LABEL_BASE =
  'position:absolute;white-space:nowrap;font:600 11px Arial,sans-serif;padding:2px 6px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.35);';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string
  ));
}

const labIcon = (name: string, selected: boolean) => {
  const size = selected ? 24 : 16;
  const dot = selected
    ? `width:24px;height:24px;left:-12px;top:-12px;border:4px solid #17184B;background:#F59E0B;`
    : `width:16px;height:16px;left:-8px;top:-8px;border:3px solid #fff;background:#D97706;`;
  const label = selected
    ? `left:18px;top:-11px;background:#17184B;color:#fff;font-size:12px;`
    : `left:14px;top:-10px;background:#fff;color:#92400E;border:1px solid #D97706;`;
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:0;height:0"><div style="position:absolute;border-radius:50%;box-sizing:border-box;box-shadow:0 1px 5px #555;${dot}"></div><div style="${LABEL_BASE}${label}">${escapeHtml(name)}</div></div>`,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
  });
};

const userIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:0;height:0"><div style="position:absolute;width:16px;height:16px;left:-8px;top:-8px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 0 0 7px #2563EB33"></div><div style="${LABEL_BASE}top:-30px;left:-16px;background:#2563EB;color:#fff;">Anda</div></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const draftIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:0;height:0"><div style="position:absolute;width:20px;height:20px;left:-10px;top:-10px;border-radius:50%;background:#DC2626;border:3px solid #fff;box-shadow:0 1px 6px #000"></div><div style="${LABEL_BASE}left:14px;top:-10px;background:#DC2626;color:#fff;">Posisi baru</div></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function MapController({
  selectedLaboratoryId,
  laboratories,
  deviceLocation,
  deviceFocusToken,
  fitAllToken,
  pickMode,
  onPickLocation,
}: Pick<
  LaboratoryOSMMapProps,
  'selectedLaboratoryId' | 'laboratories' | 'deviceLocation' | 'pickMode' | 'onPickLocation'
> & { deviceFocusToken: number; fitAllToken: number }) {
  const map = useMap();
  const lastSelectedId = useRef<string | null>(null);
  const lastFocusToken = useRef(0);
  const lastFitToken = useRef(0);
  const fittedLabs = useRef(false);
  const centeredOnDevice = useRef(false);

  useMapEvents({
    click(event) {
      if (pickMode) {
        onPickLocation?.({ latitude: event.latlng.lat, longitude: event.latlng.lng });
      }
    },
  });

  useEffect(() => {
    map.getContainer().style.cursor = pickMode ? 'crosshair' : '';
  }, [map, pickMode]);

  const fitAll = () => {
    const points: [number, number][] = laboratories.map(item => [item.latitude, item.longitude]);
    if (deviceLocation) points.push([deviceLocation.latitude, deviceLocation.longitude]);
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 18);
    else map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 18 });
  };

  // Pertama kali ada data lab: tampilkan semua lab (+ posisi perangkat).
  useEffect(() => {
    if (fittedLabs.current || laboratories.length === 0) return;
    fittedLabs.current = true;
    centeredOnDevice.current = true;
    lastSelectedId.current = selectedLaboratoryId;
    lastFitToken.current = fitAllToken;
    fitAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laboratories]);

  // Tombol "Lihat semua".
  useEffect(() => {
    if (fitAllToken === lastFitToken.current) return;
    lastFitToken.current = fitAllToken;
    fitAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitAllToken]);

  // Pilihan laboratorium berubah.
  useEffect(() => {
    if (!fittedLabs.current) return;
    if (!selectedLaboratoryId || selectedLaboratoryId === lastSelectedId.current) return;
    const selected = laboratories.find(item => item.id === selectedLaboratoryId);
    if (selected) {
      lastSelectedId.current = selected.id;
      map.setView([selected.latitude, selected.longitude], Math.max(map.getZoom(), 18), { animate: true });
    }
  }, [map, selectedLaboratoryId, laboratories]);

  // Tombol "lokasi saya", atau sekali jika belum ada lab.
  useEffect(() => {
    if (!deviceLocation) return;
    const position: [number, number] = [deviceLocation.latitude, deviceLocation.longitude];
    if (deviceFocusToken !== lastFocusToken.current) {
      lastFocusToken.current = deviceFocusToken;
      centeredOnDevice.current = true;
      map.setView(position, 18, { animate: true });
    } else if (!centeredOnDevice.current) {
      centeredOnDevice.current = true;
      map.setView(position, 16);
    }
  }, [map, deviceLocation, deviceFocusToken]);

  return null;
}

const LaboratoryOSMMap: React.FC<LaboratoryOSMMapProps> = ({
  laboratories,
  selectedLaboratoryId,
  deviceLocation,
  initialCenter,
  deviceFocusToken = 0,
  fitAllToken = 0,
  pickMode = false,
  pickedLocation = null,
  onPickLocation,
  onSelectLaboratory,
}) => (
  <div style={{ width: '100%', height: '100%', minHeight: 260, overflow: 'hidden', borderRadius: 12 }}>
    <MapContainer center={initialCenter} zoom={14} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <MapController
        selectedLaboratoryId={selectedLaboratoryId}
        laboratories={laboratories}
        deviceLocation={deviceLocation}
        deviceFocusToken={deviceFocusToken}
        fitAllToken={fitAllToken}
        pickMode={pickMode}
        onPickLocation={onPickLocation}
      />
      {laboratories
        .filter(item => item.id === selectedLaboratoryId && item.radius > 0)
        .map(item => (
          <Circle
            key={`radius-${item.id}`}
            center={[item.latitude, item.longitude]}
            radius={item.radius}
            interactive={false}
            pathOptions={{ color: '#D97706', weight: 2, dashArray: '6 4', fillColor: '#D97706', fillOpacity: 0.12 }}
          />
        ))}
      {laboratories.map(laboratory => {
        const selected = laboratory.id === selectedLaboratoryId;
        return (
          <Marker
            key={`${laboratory.id}-${selected ? 's' : 'n'}`}
            position={[laboratory.latitude, laboratory.longitude]}
            icon={labIcon(laboratory.name, selected)}
            zIndexOffset={selected ? 500 : 0}
            eventHandlers={{ click: () => { if (!pickMode) onSelectLaboratory(laboratory); } }}
          >
            <Popup>
              <strong>{laboratory.name}</strong><br />
              {laboratory.building}<br />
              Lantai {laboratory.floor || '-'}
            </Popup>
          </Marker>
        );
      })}
      {deviceLocation && (
        <>
          {deviceLocation.accuracy !== null && deviceLocation.accuracy > 0 && deviceLocation.accuracy < 1000 && (
            <Circle
              center={[deviceLocation.latitude, deviceLocation.longitude]}
              radius={deviceLocation.accuracy}
              interactive={false}
              pathOptions={{ color: '#2563EB', weight: 1, fillColor: '#2563EB', fillOpacity: 0.08 }}
            />
          )}
          <Marker
            position={[deviceLocation.latitude, deviceLocation.longitude]}
            icon={userIcon}
            zIndexOffset={1000}
            interactive={false}
          />
        </>
      )}
      {pickMode && pickedLocation && (
        <Marker
          position={[pickedLocation.latitude, pickedLocation.longitude]}
          icon={draftIcon}
          zIndexOffset={2000}
          interactive={false}
        />
      )}
    </MapContainer>
  </div>
);

export default LaboratoryOSMMap;
