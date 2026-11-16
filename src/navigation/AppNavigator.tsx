
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Text,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import { AssistantStack } from '@/navigation/AssistantStack';
import { StudentStack } from '@/navigation/StudentStack';
import { AuthScreen } from '@/screens/shared/AuthScreen';
import { APP_COLORS } from '@/constants/theme';

export const AppNavigator: React.FC = () => {
  const {
    authLoading,
    isAuthenticated,
    activeRole,
    authError,
    logout,
  } = useApp();

  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError('');

    try {
      await logout();
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : 'Gagal logout. Silakan coba lagi.',
      );
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['left', 'right']}
    >
      <View style={styles.container}>
        <View style={styles.content}>
          {authLoading ? (
            <View style={styles.center}>
              <ActivityIndicator
                size="large"
                color={APP_COLORS.primary}
              />
              <Text style={styles.loadingText}>
                Memeriksa akun...
              </Text>
            </View>
          ) : authError && !isAuthenticated ? (
            <View style={styles.center}>
              <Text style={styles.errorTitle}>
                Profil gagal dimuat
              </Text>

              <Text style={styles.errorMessage}>
                {authError}
              </Text>

              <Text style={styles.errorHint}>
                Periksa koneksi internet dan aturan akses Firestore.
              </Text>

              {logoutError ? (
                <Text style={styles.errorMessage}>
                  {logoutError}
                </Text>
              ) : null}

              <Pressable
                onPress={handleLogout}
                disabled={loggingOut}
                style={({ pressed }) => [
                  styles.errorButton,
                  pressed && styles.pressed,
                  loggingOut && styles.disabledButton,
                ]}
              >
                {loggingOut ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.errorButtonText}>
                    Keluar dan kembali ke login
                  </Text>
                )}
              </Pressable>
            </View>
          ) : !isAuthenticated ? (
            <AuthScreen />
          ) : activeRole === 'assistant' ? (
            <AssistantStack />
          ) : (
            <StudentStack />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: APP_COLORS.primary,
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 480 : '100%',
    backgroundColor: APP_COLORS.background,
  },
  content: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#687386',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#C62828',
    textAlign: 'center',
  },
  errorMessage: {
    marginTop: 8,
    fontSize: 14,
    color: '#344054',
    textAlign: 'center',
  },
  errorHint: {
    marginTop: 8,
    fontSize: 13,
    color: '#687386',
    textAlign: 'center',
  },
  errorButton: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: APP_COLORS.primary,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.65,
  },
  pressed: {
    opacity: 0.75,
  },
});

export default AppNavigator;
