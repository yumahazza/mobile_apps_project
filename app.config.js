/**
 * Expo dynamic config for the Birela Maps feature.
 * Keep app.json as the source of the existing app configuration.
 * Set GOOGLE_MAPS_API_KEY in the build environment; never commit the key.
 */
module.exports = ({ config }) => {
  const plugins = [...(config.plugins ?? [])];
  const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (mapsApiKey) {
    plugins.push([
      'react-native-maps',
      { androidGoogleMapsApiKey: mapsApiKey },
    ]);
  }

  return {
    ...config,
    plugins,
  };
};
