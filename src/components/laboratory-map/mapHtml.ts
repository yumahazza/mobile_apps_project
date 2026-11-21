import type { LaboratoryLocation } from '@/services/laboratoryMapService';
import type { DeviceCoordinates } from '@/services/mapLocationAdapter';

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function createOSMHtml(
  laboratories: LaboratoryLocation[],
  selectedLaboratoryId: string | null,
  deviceLocation: DeviceCoordinates | null,
  initialCenter: [number, number],
): string {
  const initialData = safeJson({
    laboratories,
    selectedLaboratoryId,
    deviceLocation,
    initialCenter,
  });

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html, body, #map { height:100%; width:100%; margin:0; padding:0; background:#eef2f5; }
    .lab-marker { width:18px; height:18px; border-radius:50%; background:#D97706; border:3px solid white; box-shadow:0 1px 5px #555; }
    .lab-marker.selected { background:#2563EB; width:22px; height:22px; }
    .user-marker { width:16px; height:16px; border-radius:50%; background:#2563EB; border:3px solid white; box-shadow:0 0 0 7px #2563EB33; }
    .leaflet-popup-content { font-family:Arial,sans-serif; font-size:13px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const initial = ${initialData};
    const map = L.map('map').setView(initial.initialCenter, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:19,
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    const labLayer = L.layerGroup().addTo(map);
    let userMarker = null;
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[char]));
    function drawMarkers(data) {
      labLayer.clearLayers();
      data.laboratories.forEach(lab => {
        const selected = lab.id === data.selectedLaboratoryId;
        const marker = L.marker([lab.latitude, lab.longitude], {
          icon:L.divIcon({
            className:'',
            html:'<div class="lab-marker ' + (selected ? 'selected' : '') + '"></div>',
            iconSize:selected ? [28,28] : [24,24],
            iconAnchor:selected ? [14,14] : [12,12]
          })
        });
        marker.bindPopup('<b>' + escapeHtml(lab.name) + '</b><br>' +
          escapeHtml(lab.building) + '<br>Lantai ' + escapeHtml(lab.floor || '-') +
          '<br><small>Ketuk untuk melihat aktivitas praktikum</small>');
        marker.on('click', () => {
          window.ReactNativeWebView?.postMessage(JSON.stringify({type:'selectLaboratory', id:lab.id}));
        });
        marker.addTo(labLayer);
      });
      if (data.deviceLocation) {
        const position = [data.deviceLocation.latitude, data.deviceLocation.longitude];
        if (userMarker) userMarker.setLatLng(position);
        else userMarker = L.marker(position, {
          icon:L.divIcon({className:'', html:'<div class="user-marker"></div>', iconSize:[22,22], iconAnchor:[11,11]})
        }).addTo(map).bindPopup('Lokasi Anda');
      } else if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
      }
    }
    drawMarkers(initial);
    window.updateOSMMap = data => drawMarkers(data);
    window.centerOSMMap = (lat,lng) => map.setView([lat,lng], 17, {animate:true});
    window.ReactNativeWebView?.postMessage(JSON.stringify({type:'mapReady'}));
  </script>
</body>
</html>`;
}
