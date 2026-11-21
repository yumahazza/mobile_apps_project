import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import type { LaboratoryOSMMapProps } from './LaboratoryOSMMap.types';
import { createOSMHtml } from './mapHtml';

const LaboratoryOSMMap: React.FC<LaboratoryOSMMapProps> = ({
  laboratories,
  selectedLaboratoryId,
  deviceLocation,
  initialCenter,
  onSelectLaboratory,
}) => {
  const webViewRef = useRef<WebView>(null);
  const html = useMemo(
    () => createOSMHtml(laboratories, selectedLaboratoryId, deviceLocation, initialCenter),
    [],
  );

  const updateMap = useCallback(() => {
    const payload = JSON.stringify({
      laboratories,
      selectedLaboratoryId,
      deviceLocation,
      initialCenter,
    }).replace(/</g, '\u003c');
    webViewRef.current?.injectJavaScript(`window.updateOSMMap?.(${payload}); true;`);
  }, [laboratories, selectedLaboratoryId, deviceLocation, initialCenter]);

  useEffect(() => {
    updateMap();
  }, [updateMap]);

  useEffect(() => {
    if (!selectedLaboratoryId) return;
    const selected = laboratories.find(item => item.id === selectedLaboratoryId);
    if (selected) {
      webViewRef.current?.injectJavaScript(
        `window.centerOSMMap?.(${selected.latitude}, ${selected.longitude}); true;`,
      );
    }
  }, [selectedLaboratoryId, laboratories]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type?: string; id?: string };
      if (message.type === 'selectLaboratory' && message.id) {
        const selected = laboratories.find(item => item.id === message.id);
        if (selected) onSelectLaboratory(selected);
      }
    } catch {
      // Ignore invalid messages from the embedded map.
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        onLoadEnd={updateMap}
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
