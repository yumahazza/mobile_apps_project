import React from 'react';
import {
  View,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Text,
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
  } = useApp();

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
          ) : !isAuthenticated ? (
            <AuthScreen />
          ) : authError ? (
            <View style={styles.center}>
              <Text style={styles.errorTitle}>
                Profil gagal dimuat
              </Text>
              <Text style={styles.errorMessage}>
                {authError}
              </Text>
              <Text style={styles.errorHint}>
                Periksa koneksi dan aturan akses Firestore.
              </Text>
            </View>
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
});

export default AppNavigator;
