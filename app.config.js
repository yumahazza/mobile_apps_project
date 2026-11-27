/**
 * Expo dynamic config.
 * app.json tetap menjadi sumber konfigurasi utama.
 *
 * Peta Birela memakai OpenStreetMap (Leaflet di dalam react-native-webview),
 * sehingga TIDAK membutuhkan Google Maps API key maupun plugin react-native-maps.
 * Izin lokasi Android/iOS diatur oleh plugin "expo-location" di app.json.
 */
module.exports = ({ config }) => config;
