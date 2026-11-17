import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  registerWithEmail,
  signInWithEmail,
} from '@/services/authService';
import { useApp } from '@/context/AppContext';
import { APP_COLORS, APP_FONTS, APP_RADIUS, APP_SPACING } from '@/constants/theme';

type AuthMode = 'login' | 'register';

export const AuthScreen: React.FC = () => {
  const { authError } = useApp();

  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [nim, setNim] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const isRegister = mode === 'register';

  const handleSubmit = async () => {
    if (loading) return;

    setErrorMessage('');

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setErrorMessage('Email dan password wajib diisi.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorMessage('Format email belum valid.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password minimal 6 karakter.');
      return;
    }

    if (isRegister) {
      if (!name.trim()) {
        setErrorMessage('Nama wajib diisi.');
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage('Konfirmasi password tidak cocok.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegister) {
        await registerWithEmail(normalizedEmail, password, {
          name: name.trim(),
          nim: nim.trim() || undefined,
          department: department.trim() || undefined,
        });
      } else {
        await signInWithEmail(normalizedEmail, password);
      }
    } catch (error) {
      const code =
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? String(error.code)
          : '';

      const message =
        error instanceof Error ? error.message : '';

      if (code.includes('email-already-in-use')) {
        setErrorMessage('Email ini sudah terdaftar.');
      } else if (code.includes('invalid-email')) {
        setErrorMessage('Format email belum valid.');
      } else if (code.includes('weak-password')) {
        setErrorMessage('Password terlalu lemah.');
      } else if (
        code.includes('invalid-credential') ||
        code.includes('wrong-password') ||
        code.includes('user-not-found')
      ) {
        setErrorMessage('Email atau password salah.');
      } else if (code.includes('network-request-failed')) {
        setErrorMessage('Koneksi internet bermasalah.');
      } else if (code.includes('too-many-requests')) {
        setErrorMessage('Terlalu banyak percobaan login.');
      } else if (code.includes('operation-not-allowed')) {
        setErrorMessage('Login email/password belum aktif.');
      } else {
        setErrorMessage(message || 'Terjadi kesalahan. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  const changeMode = () => {
    if (loading) return;

    setMode(isRegister ? 'login' : 'register');
    setErrorMessage('');
    setConfirmPassword('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>
            {isRegister ? 'Daftar Akun' : 'Presensi Praktikum'}
          </Text>
          <Text style={styles.description}>
            {isRegister
              ? 'Lengkapi data akun praktikan.'
              : 'Masuk dengan akun terdaftar.'}
          </Text>

          {isRegister && (
            <>
              <Text style={styles.label}>Nama Lengkap</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Nama lengkap"
                placeholderTextColor={APP_COLORS.neutral400}
                autoCapitalize="words"
                editable={!loading}
              />

              <Text style={styles.label}>NIM (Opsional)</Text>
              <TextInput
                style={styles.input}
                value={nim}
                onChangeText={setNim}
                placeholder="Nomor Induk Mahasiswa"
                placeholderTextColor={APP_COLORS.neutral400}
                editable={!loading}
              />

              <Text style={styles.label}>Program Studi (Opsional)</Text>
              <TextInput
                style={styles.input}
                value={department}
                onChangeText={setDepartment}
                placeholder="Contoh: Informatika"
                placeholderTextColor={APP_COLORS.neutral400}
                editable={!loading}
              />
            </>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="nama@email.com"
            placeholderTextColor={APP_COLORS.neutral400}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Minimal 6 karakter"
              placeholderTextColor={APP_COLORS.neutral400}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!loading}
            />
            <Pressable
              onPress={() => setShowPassword((prev) => !prev)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? 'Sembunyikan password' : 'Tampilkan password'
              }
              style={styles.eyeButton}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={APP_COLORS.textSecondary}
              />
            </Pressable>
          </View>

          {isRegister && (
            <>
              <Text style={styles.label}>Konfirmasi Password</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Ulangi password"
                  placeholderTextColor={APP_COLORS.neutral400}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <Pressable
                  onPress={() => setShowConfirmPassword((prev) => !prev)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showConfirmPassword
                      ? 'Sembunyikan konfirmasi password'
                      : 'Tampilkan konfirmasi password'
                  }
                  style={styles.eyeButton}>
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={APP_COLORS.textSecondary}
                  />
                </Pressable>
              </View>
            </>
          )}

          {(errorMessage || authError) && (
            <Text style={styles.error}>{errorMessage || authError}</Text>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              loading && styles.disabledButton,
              pressed && !loading && styles.pressed,
            ]}
            onPress={handleSubmit}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={APP_COLORS.white} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isRegister ? 'Daftar' : 'Masuk'}
              </Text>
            )}
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {isRegister ? 'Sudah punya akun? ' : 'Belum punya akun? '}
            </Text>

            <Pressable onPress={changeMode} disabled={loading} hitSlop={8}>
              <Text style={styles.switchAction}>
                {isRegister ? 'Masuk' : 'Daftar'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: APP_SPACING.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.modal,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    padding: APP_SPACING.xxl,
    gap: 8,
  },
  title: {
    fontFamily: APP_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
    color: APP_COLORS.inkPrimary,
  },
  description: {
    fontFamily: APP_FONTS.regular,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
    lineHeight: 19,
    marginBottom: APP_SPACING.sm,
  },
  label: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 13,
    color: APP_COLORS.inkPrimary,
    marginTop: 4,
  },
  input: {
    fontFamily: APP_FONTS.regular,
    minHeight: 48,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: APP_RADIUS.md,
    paddingHorizontal: 14,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
    backgroundColor: APP_COLORS.white,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: APP_RADIUS.md,
    backgroundColor: APP_COLORS.white,
    paddingLeft: 14,
    paddingRight: 6,
  },
  passwordInput: {
    flex: 1,
    fontFamily: APP_FONTS.regular,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
    minHeight: 46,
  },
  eyeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    fontFamily: APP_FONTS.medium,
    color: APP_COLORS.dangerText,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: APP_RADIUS.md,
    backgroundColor: APP_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  disabledButton: {
    opacity: 0.65,
  },
  pressed: {
    opacity: 0.82,
  },
  primaryButtonText: {
    fontFamily: APP_FONTS.bold,
    color: APP_COLORS.white,
    fontSize: 15,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  switchText: {
    fontFamily: APP_FONTS.regular,
    color: APP_COLORS.textSecondary,
    fontSize: 13,
  },
  switchAction: {
    fontFamily: APP_FONTS.bold,
    color: APP_COLORS.primary,
    fontSize: 13,
  },
});

export default AuthScreen;
