import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import WebView, {
  type WebViewMessageEvent,
} from 'react-native-webview';

import type { LaboratoryOSMMapProps } from './LaboratoryOSMMap.types';
import { OSM_WEBVIEW_BASE_URL, createOSMHtml } from './mapHtml';

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
}) => {
  const webViewRef = useRef<WebView>(null);
  const readyRef = useRef(false);

  // HTML dibuat sekali; data selanjutnya dikirim lewat injectJavaScript.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => createOSMHtml(initialCenter), []);
  const source = useMemo(
    () => ({ html, baseUrl: OSM_WEBVIEW_BASE_URL }),
    [html],
  );

  const updateMap = useCallback(() => {
    if (!readyRef.current) return;
    const payload = JSON.stringify({
      laboratories,
      selectedLaboratoryId,
      deviceLocation,
      deviceFocusToken,
      fitAllToken,
      pickMode,
      pickedLocation,
    }).replace(/</g, '\\u003c');
    webViewRef.current?.injectJavaScript(
      `window.updateOSMMap && window.updateOSMMap(${payload}); true;`,
    );
  }, [
    laboratories,
    selectedLaboratoryId,
    deviceLocation,
    deviceFocusToken,
    fitAllToken,
    pickMode,
    pickedLocation,
  ]);

  useEffect(() => {
    updateMap();
  }, [updateMap]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        id?: string;
        latitude?: number;
        longitude?: number;
      };
      if (message.type === 'mapReady') {
        readyRef.current = true;
        updateMap();
      } else if (
        message.type === 'pickLocation' &&
        typeof message.latitude === 'number' &&
        typeof message.longitude === 'number'
      ) {
        onPickLocation?.({ latitude: message.latitude, longitude: message.longitude });
      } else if (message.type === 'selectLaboratory' && message.id) {
        const selected = laboratories.find(item => item.id === message.id);
        if (selected) onSelectLaboratory(selected);
      }
    } catch {
      // Abaikan pesan tidak valid dari peta.
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={source}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={request => {
          // Tautan atribusi OSM/Leaflet dibuka di browser, bukan di dalam peta.
          if (
            request.url === OSM_WEBVIEW_BASE_URL ||
            request.url.startsWith('about:') ||
            request.url.startsWith('data:')
          ) {
            return true;
          }
          if (/^https?:\/\//.test(request.url)) {
            void Linking.openURL(request.url);
          }
          return false;
        }}
        style={styles.webView}
        nestedScrollEnabled
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  webView: { flex: 1, backgroundColor: '#eef2f5' },
});

export default LaboratoryOSMMap;
