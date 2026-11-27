/**
 * Alamat "palsu" sebagai base URL WebView. OpenStreetMap mewajibkan header
 * Referer pada permintaan tile; tanpa baseUrl, WebView Android memuat HTML
 * dengan origin null sehingga tile bisa diblokir.
 */
export const OSM_WEBVIEW_BASE_URL = 'https://birela.app/';

/**
 * HTML Leaflet statis. Data (laboratorium, lokasi perangkat, pilihan) dikirim
 * dari React Native lewat `window.updateOSMMap(data)` setelah peta siap.
 *
 * Penanda:
 * - Laboratorium : pin oranye + nama (terpilih: lebih besar, cincin navy, lingkaran radius).
 * - Lokasi Anda  : titik biru berdenyut + lingkaran akurasi + label "Anda".
 * - Posisi baru  : pin merah (hanya saat mode atur posisi).
 */
export function createOSMHtml(initialCenter: [number, number]): string {
  const center = JSON.stringify(initialCenter);

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html, body, #map { height:100%; width:100%; margin:0; padding:0; background:#eef2f5; }
    .pin { position:relative; width:0; height:0; }
    .pin .dot { position:absolute; border-radius:50%; box-sizing:border-box; }
    .pin .label { position:absolute; left:14px; top:-10px; white-space:nowrap; font:600 11px Arial,sans-serif;
      padding:2px 6px; border-radius:6px; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,.35); }
    .lab .dot { width:16px; height:16px; left:-8px; top:-8px; background:#D97706; border:3px solid #fff; box-shadow:0 1px 5px #555; }
    .lab .label { color:#92400E; border:1px solid #D97706; }
    .lab.selected .dot { width:24px; height:24px; left:-12px; top:-12px; border:4px solid #17184B; background:#F59E0B; }
    .lab.selected .label { left:18px; top:-11px; background:#17184B; color:#fff; border-color:#17184B; font-size:12px; }
    .me .dot { width:16px; height:16px; left:-8px; top:-8px; background:#2563EB; border:3px solid #fff;
      box-shadow:0 0 0 0 rgba(37,99,235,.5); animation:pulse 2s infinite; }
    .me .label { background:#2563EB; color:#fff; top:-30px; left:-16px; }
    .draft .dot { width:20px; height:20px; left:-10px; top:-10px; background:#DC2626; border:3px solid #fff; box-shadow:0 1px 6px #000; }
    .draft .label { background:#DC2626; color:#fff; }
    @keyframes pulse { 70% { box-shadow:0 0 0 14px rgba(37,99,235,0); } 100% { box-shadow:0 0 0 0 rgba(37,99,235,0); } }
    .picking, .picking .leaflet-interactive { cursor:crosshair !important; }
    .leaflet-popup-content { font-family:Arial,sans-serif; font-size:13px; }
    #fallback { display:none; position:absolute; inset:0; align-items:center; justify-content:center; text-align:center;
      padding:24px; font-family:Arial,sans-serif; font-size:13px; color:#4A5073; background:#eef2f5; z-index:1000; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="fallback">Peta tidak dapat dimuat. Periksa koneksi internet lalu buka kembali halaman ini.</div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    function post(message) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }
    if (typeof L === 'undefined') {
      document.getElementById('fallback').style.display = 'flex';
      post({ type: 'mapError' });
    } else {
      const map = L.map('map', { zoomControl: true }).setView(${center}, 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const labLayer = L.layerGroup().addTo(map);
      const meLayer = L.layerGroup().addTo(map);
      const draftLayer = L.layerGroup().addTo(map);
      let pickMode = false;
      let lastSelectedId = null;
      let lastFocusToken = 0;
      let lastFitToken = 0;
      let fittedLabs = false;
      let centeredOnDevice = false;

      const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
      }[char]));

      function pinIcon(kind, label, size) {
        return L.divIcon({
          className: '',
          html: '<div class="pin ' + kind + '"><div class="dot"></div><div class="label">' + escapeHtml(label) + '</div></div>',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2]
        });
      }

      map.on('click', e => {
        if (pickMode) post({ type: 'pickLocation', latitude: e.latlng.lat, longitude: e.latlng.lng });
      });

      function fitAll(data) {
        const points = (data.laboratories || []).map(lab => [lab.latitude, lab.longitude]);
        if (data.deviceLocation) points.push([data.deviceLocation.latitude, data.deviceLocation.longitude]);
        if (points.length === 0) return false;
        if (points.length === 1) map.setView(points[0], 18);
        else map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 18 });
        return true;
      }

      function draw(data) {
        labLayer.clearLayers();
        (data.laboratories || []).forEach(lab => {
          const selected = lab.id === data.selectedLaboratoryId;
          const marker = L.marker([lab.latitude, lab.longitude], {
            icon: pinIcon('lab' + (selected ? ' selected' : ''), lab.name, 28),
            zIndexOffset: selected ? 500 : 0
          });
          marker.bindPopup('<b>' + escapeHtml(lab.name) + '</b><br>' +
            escapeHtml(lab.building) + '<br>Lantai ' + escapeHtml(lab.floor || '-'));
          marker.on('click', () => { if (!pickMode) post({ type: 'selectLaboratory', id: lab.id }); });
          marker.addTo(labLayer);
          if (selected && lab.radius > 0) {
            L.circle([lab.latitude, lab.longitude], {
              radius: lab.radius, color: '#D97706', weight: 2, dashArray: '6 4',
              fillColor: '#D97706', fillOpacity: 0.12, interactive: false
            }).addTo(labLayer);
          }
        });

        meLayer.clearLayers();
        if (data.deviceLocation) {
          const position = [data.deviceLocation.latitude, data.deviceLocation.longitude];
          const accuracy = data.deviceLocation.accuracy;
          if (accuracy && accuracy > 0 && accuracy < 1000) {
            L.circle(position, {
              radius: accuracy, color: '#2563EB', weight: 1, fillColor: '#2563EB', fillOpacity: 0.08, interactive: false
            }).addTo(meLayer);
          }
          L.marker(position, { icon: pinIcon('me', 'Anda', 22), zIndexOffset: 1000, interactive: false }).addTo(meLayer);
        }

        draftLayer.clearLayers();
        if (data.pickMode && data.pickedLocation) {
          L.marker([data.pickedLocation.latitude, data.pickedLocation.longitude], {
            icon: pinIcon('draft', 'Posisi baru', 26), zIndexOffset: 2000, interactive: false
          }).addTo(draftLayer);
        }
      }

      window.updateOSMMap = function (data) {
        pickMode = !!data.pickMode;
        document.getElementById('map').classList.toggle('picking', pickMode);
        draw(data);

        const labs = data.laboratories || [];

        // Pertama kali ada data lab: tampilkan semua lab (+ posisi perangkat).
        if (!fittedLabs && labs.length > 0) {
          fittedLabs = true;
          centeredOnDevice = true;
          lastSelectedId = data.selectedLaboratoryId;
          lastFitToken = data.fitAllToken || 0;
          fitAll(data);
          return;
        }

        // Tombol "Lihat semua".
        if ((data.fitAllToken || 0) !== lastFitToken) {
          lastFitToken = data.fitAllToken || 0;
          fitAll(data);
          return;
        }

        // Pilihan laboratorium berubah: pusatkan ke lab tersebut.
        if (data.selectedLaboratoryId && data.selectedLaboratoryId !== lastSelectedId) {
          const lab = labs.find(item => item.id === data.selectedLaboratoryId);
          if (lab) {
            lastSelectedId = lab.id;
            map.setView([lab.latitude, lab.longitude], Math.max(map.getZoom(), 18), { animate: true });
          }
        }

        // Tombol "lokasi saya", atau sekali jika belum ada lab sama sekali.
        if (data.deviceLocation) {
          const position = [data.deviceLocation.latitude, data.deviceLocation.longitude];
          if ((data.deviceFocusToken || 0) !== lastFocusToken) {
            lastFocusToken = data.deviceFocusToken || 0;
            centeredOnDevice = true;
            map.setView(position, 18, { animate: true });
          } else if (!centeredOnDevice) {
            centeredOnDevice = true;
            map.setView(position, 16);
          }
        }
      };

      post({ type: 'mapReady' });
    }
  </script>
</body>
</html>`;
}
