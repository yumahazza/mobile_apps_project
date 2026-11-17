import { Redirect } from 'expo-router';

/**
 * Rute template starter dialihkan ke root AppNavigator.
 */
export default function LegacyExploreRedirect() {
  return <Redirect href="/" />;
}
