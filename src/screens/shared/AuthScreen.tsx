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

import {
  registerWithEmail,
  signInWithEmail,
} from '@/services/authService';

import { useApp } from '@/context/AppContext';
import { APP_COLORS } from '@/constants/theme';

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
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const isRegister = mode === 'register';

  const handleSubmit = async () => {
    setErrorMessage('');

    const normalizedEmail = email.trim();

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

      // AppContext akan mendeteksi perubahan auth dan memuat profil.
    } catch (error) {
      const code =
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? String(error.code)
          : '';

      const message =
        error instanceof Error ? error.message : '';

      if (
        code.includes('email-already-in-use')
      ) {
        setErrorMessage('Email ini sudah terdaftar.');
      } else if (
        code.includes('invalid-email')
      ) {
        setErrorMessage('Format email belum valid.');
      } else if (
        code.includes('weak-password')
      ) {
        setErrorMessage('Password terlalu lemah.');
      } else if (
        code.includes('invalid-credential') ||
        code.includes('wrong-password') ||
        code.includes('user-not-found')
      ) {
        setErrorMessage('Email atau password salah.');
      } else if (
        code.includes('network-request-failed')
      ) {
        setErrorMessage('Koneksi internet bermasalah.');
      } else {
        setErrorMessage(
          message || 'Terjadi kesalahan. Silakan coba lagi.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const changeMode = () => {
    setMode(isRegister ? 'login' : 'register');
    setErrorMessage('');
    setConfirmPassword('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.brand}>
            <Text style={styles.brandTitle}>Mobile Apps</Text>
            <Text style={styles.brandSubtitle}>
              Praktikum jadi lebih mudah
            </Text>
          </View>

          <Text style={styles.title}>
            {isRegister ? 'Buat Akun' : 'Selamat Datang'}
          </Text>

          <Text style={styles.description}>
            {isRegister
              ? 'Daftarkan akun praktikanmu untuk memulai.'
              : 'Masuk menggunakan akun yang sudah terdaftar.'}
          </Text>

          {isRegister && (
            <>
              <Text style={styles.label}>Nama lengkap</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Masukkan nama lengkap"
                placeholderTextColor="#9299A5"
                autoCapitalize="words"
                editable={!loading}
              />

              <Text style={styles.label}>NIM (opsional)</Text>
              <TextInput
                style={styles.input}
                value={nim}
                onChangeText={setNim}
                placeholder="Masukkan NIM"
                placeholderTextColor="#9299A5"
                editable={!loading}
              />

              <Text style={styles.label}>Program studi (opsional)</Text>
              <TextInput
                style={styles.input}
                value={department}
                onChangeText={setDepartment}
                placeholder="Contoh: Informatika"
                placeholderTextColor="#9299A5"
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
            placeholderTextColor="#9299A5"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Minimal 6 karakter"
            placeholderTextColor="#9299A5"
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />

          {isRegister && (
            <>
              <Text style={styles.label}>Konfirmasi password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Ulangi password"
                placeholderTextColor="#9299A5"
                secureTextEntry
                autoCapitalize="none"
                editable={!loading}
              />
            </>
          )}

          {(errorMessage || authError) && (
            <Text style={styles.error}>
              {errorMessage ||
                'Gagal memuat profil. Periksa akun dan aturan Firestore.'}
            </Text>
          )}

          <Pressable
            style={[
              styles.primaryButton,
              loading && styles.disabledButton,
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isRegister ? 'Daftar' : 'Masuk'}
              </Text>
            )}
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {isRegister
                ? 'Sudah punya akun? '
                : 'Belum punya akun? '}
            </Text>

            <Pressable
              onPress={changeMode}
              disabled={loading}
            >
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
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    gap: 10,
  },
  brand: {
    marginBottom: 18,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: APP_COLORS.primary,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#687386',
    marginTop: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#202938',
  },
  description: {
    fontSize: 14,
    color: '#687386',
    lineHeight: 21,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#344054',
    marginTop: 4,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#D8DEE8',
    borderRadius: 10,
    paddingHorizontal: 14,
    color: '#202938',
    backgroundColor: '#FFFFFF',
  },
  error: {
    color: '#C62828',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: APP_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  disabledButton: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  switchText: {
    color: '#687386',
    fontSize: 13,
  },
  switchAction: {
    color: APP_COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
});

export default AuthScreen;
