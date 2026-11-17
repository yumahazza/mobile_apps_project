import { Redirect } from 'expo-router';

/**
 * Rute legacy Sprint 1 dialihkan ke root AppNavigator
 * agar seluruh akses tetap melewati guard autentikasi dan role Firebase.
 */
export default function LegacySessionDetailRedirect() {
  return <Redirect href="/" />;
}
