import { Redirect } from 'expo-router';

/**
 * Rute uji coba lama dialihkan ke root AppNavigator.
 */
export default function LegacyTestAiRedirect() {
  return <Redirect href="/" />;
}
