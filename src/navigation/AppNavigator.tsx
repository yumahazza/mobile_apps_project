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
import { APP_COLORS, APP_FONTS, APP_RADIUS } from '@/constants/theme';

export const AppNavigator: React.FC = () => {
  const {
    authLoading,
    isAuthenticated,
    activeRole,
    authError,
    firebaseUnavailable,
    logout,
    latestForegroundNotification,
    dismissForegroundNotification,
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
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <View style={styles.container}>
        <View style={styles.content}>
          {authLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={APP_COLORS.primary} />
              <Text style={styles.loadingText}>Memeriksa akun...</Text>
            </View>
          ) : authError && !isAuthenticated ? (
            <View style={styles.center}>
              <Text style={styles.errorTitle}>
                {firebaseUnavailable
                  ? 'Development Build Diperlukan'
                  : 'Profil Gagal Dimuat'}
              </Text>

              <Text style={styles.errorMessage}>{authError}</Text>

              <Text style={styles.errorHint}>
                {firebaseUnavailable
                  ? 'Jalankan aplikasi dengan Development Build Android/iOS lalu npx expo start --dev-client.'
                  : 'Periksa koneksi internet dan akses database.'}
              </Text>

              {!firebaseUnavailable && logoutError ? (
                <Text style={styles.errorMessage}>{logoutError}</Text>
              ) : null}

              {!firebaseUnavailable ? (
                <Pressable
                  onPress={handleLogout}
                  disabled={loggingOut}
                  style={({ pressed }) => [
                    styles.errorButton,
                    pressed && styles.pressed,
                    loggingOut && styles.disabledButton,
                  ]}>
                  {loggingOut ? (
                    <ActivityIndicator color={APP_COLORS.white} />
                  ) : (
                    <Text style={styles.errorButtonText}>
                      Kembali ke Login
                    </Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          ) : !isAuthenticated ? (
            <AuthScreen />
          ) : activeRole === 'assistant' ? (
            <AssistantStack />
          ) : (
            <StudentStack />
          )}

          {isAuthenticated && latestForegroundNotification ? (
            <View style={styles.pushBannerWrapper} pointerEvents="box-none">
              <View style={styles.pushBanner}>
                <View style={styles.pushBannerTextBox}>
                  <Text style={styles.pushBannerTitle} numberOfLines={1}>
                    {latestForegroundNotification.title}
                  </Text>
                  <Text style={styles.pushBannerBody} numberOfLines={2}>
                    {latestForegroundNotification.body}
                  </Text>
                </View>
                <Pressable
                  onPress={dismissForegroundNotification}
                  style={({ pressed }) => [
                    styles.pushBannerClose,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.pushBannerCloseText}>Tutup</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
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
    fontFamily: APP_FONTS.medium,
    marginTop: 12,
    fontSize: 14,
    color: APP_COLORS.textSecondary,
  },
  errorTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 18,
    color: APP_COLORS.dangerText,
    textAlign: 'center',
  },
  errorMessage: {
    fontFamily: APP_FONTS.regular,
    marginTop: 8,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorHint: {
    fontFamily: APP_FONTS.regular,
    marginTop: 8,
    fontSize: 12,
    color: APP_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorButton: {
    marginTop: 20,
    minHeight: 46,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: APP_RADIUS.md,
    backgroundColor: APP_COLORS.primary,
    justifyContent: 'center',
  },
  errorButtonText: {
    fontFamily: APP_FONTS.bold,
    color: APP_COLORS.white,
    fontSize: 14,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.65,
  },
  pressed: {
    opacity: 0.78,
  },
  pushBannerWrapper: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    zIndex: 50,
  },
  pushBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_COLORS.inkPrimary,
    borderRadius: APP_RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  pushBannerTextBox: {
    flex: 1,
  },
  pushBannerTitle: {
    fontFamily: APP_FONTS.bold,
    fontSize: 13,
    color: APP_COLORS.white,
  },
  pushBannerBody: {
    fontFamily: APP_FONTS.regular,
    fontSize: 12,
    color: APP_COLORS.white,
    opacity: 0.9,
    marginTop: 2,
    lineHeight: 16,
  },
  pushBannerClose: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pushBannerCloseText: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    color: APP_COLORS.softBlue,
  },
});

export default AppNavigator;
