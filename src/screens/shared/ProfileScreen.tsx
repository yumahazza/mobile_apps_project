import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/Card';
import { AppHeader } from '@/components/AppHeader';
import { BottomNavigation } from '@/components/BottomNavigation';
import { CustomButton } from '@/components/CustomButton';
import { NavigationProp } from '@/navigation/navigationTypes';
import {
  APP_COLORS,
  APP_RADIUS,
  APP_SPACING,
} from '@/constants/theme';

interface ProfileScreenProps {
  navigation: NavigationProp;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  navigation,
}) => {
  const {
    activeUser,
    activeRole,
    logout,
  } = useApp();

  const [loggingOut, setLoggingOut] = useState(false);
  const [activeModal, setActiveModal] = useState<
    'info' | 'settings' | 'help' | null
  >(null);

  const initial = (activeUser.name || 'U')
    .charAt(0)
    .toUpperCase();

  const handleLogout = () => {
    if (loggingOut) return;

    Alert.alert(
      'Logout',
      'Yakin ingin keluar dari akun ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);

            try {
              await logout();
            } catch (error) {
              Alert.alert(
                'Logout gagal',
                error instanceof Error
                  ? error.message
                  : 'Terjadi kesalahan. Silakan coba lagi.',
              );
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'left', 'right']}
    >
      <AppHeader
        title="Profil"
        onBack={() => navigation.goBack()}
        onNotificationPress={() =>
          navigation.navigate('Notifications')
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {initial}
            </Text>
          </View>

          <Text style={styles.userNameText}>
            {activeUser.name}
          </Text>

          <Text style={styles.userRoleText}>
            {activeRole === 'assistant'
              ? 'Asisten Praktikum'
              : `NIM ${activeUser.nim || '-'}`}
          </Text>

          {activeUser.department ? (
            <Text style={styles.departmentText}>
              {activeUser.department}
            </Text>
          ) : null}
        </Card>

        {/* Menu Items */}
        <View style={styles.menuList}>
          {/* Informasi Akun */}
          <Pressable
            onPress={() => setActiveModal('info')}
            style={({ pressed }) => [
              styles.menuItem,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.menuLeft}>
              <View style={styles.menuIconBox}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={APP_COLORS.primary}
                />
              </View>
              <Text style={styles.menuLabel}>
                Informasi Akun
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={APP_COLORS.neutral400}
            />
          </Pressable>

          {/* Pengaturan */}
          <Pressable
            onPress={() => setActiveModal('settings')}
            style={({ pressed }) => [
              styles.menuItem,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.menuLeft}>
              <View style={styles.menuIconBox}>
                <Ionicons
                  name="settings-outline"
                  size={20}
                  color={APP_COLORS.primary}
                />
              </View>
              <Text style={styles.menuLabel}>
                Pengaturan
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={APP_COLORS.neutral400}
            />
          </Pressable>

          {/* Bantuan */}
          <Pressable
            onPress={() => setActiveModal('help')}
            style={({ pressed }) => [
              styles.menuItem,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.menuLeft}>
              <View style={styles.menuIconBox}>
                <Ionicons
                  name="help-circle-outline"
                  size={20}
                  color={APP_COLORS.primary}
                />
              </View>
              <Text style={styles.menuLabel}>
                Bantuan
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={APP_COLORS.neutral400}
            />
          </Pressable>

          {/* Logout Firebase */}
          <Pressable
            onPress={handleLogout}
            disabled={loggingOut}
            style={({ pressed }) => [
              styles.menuItem,
              styles.resetItem,
              pressed && styles.pressed,
              loggingOut && styles.disabledItem,
            ]}
          >
            <View style={styles.menuLeft}>
              <View
                style={[
                  styles.menuIconBox,
                  styles.resetIconBox,
                ]}
              >
                <Ionicons
                  name="log-out-outline"
                  size={20}
                  color={APP_COLORS.danger}
                />
              </View>

              <Text
                style={[
                  styles.menuLabel,
                  styles.resetLabel,
                ]}
              >
                {loggingOut
                  ? 'Sedang logout...'
                  : 'Logout'}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={APP_COLORS.danger}
            />
          </Pressable>
        </View>
      </ScrollView>

      {/* Informasi Akun Modal */}
      <Modal
        visible={activeModal === 'info'}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Informasi Akun
            </Text>

            <View style={styles.infoModalList}>
              <View style={styles.infoModalRow}>
                <Text style={styles.infoModalLabel}>
                  Nama Lengkap
                </Text>
                <Text style={styles.infoModalVal}>
                  {activeUser.name}
                </Text>
              </View>

              <View style={styles.infoModalRow}>
                <Text style={styles.infoModalLabel}>
                  Peran
                </Text>
                <Text style={styles.infoModalVal}>
                  {activeRole === 'assistant'
                    ? 'Asisten Praktikum'
                    : 'Praktikan'}
                </Text>
              </View>

              {activeUser.nim ? (
                <View style={styles.infoModalRow}>
                  <Text style={styles.infoModalLabel}>
                    NIM
                  </Text>
                  <Text style={styles.infoModalVal}>
                    {activeUser.nim}
                  </Text>
                </View>
              ) : null}

              <View style={styles.infoModalRow}>
                <Text style={styles.infoModalLabel}>
                  Email
                </Text>
                <Text style={styles.infoModalVal}>
                  {activeUser.email || '-'}
                </Text>
              </View>

              <View style={styles.infoModalRow}>
                <Text style={styles.infoModalLabel}>
                  Departemen
                </Text>
                <Text style={styles.infoModalVal}>
                  {activeUser.department || '-'}
                </Text>
              </View>
            </View>

            <CustomButton
              title="Tutup"
              variant="primary"
              size="md"
              onPress={() => setActiveModal(null)}
            />
          </View>
        </View>
      </Modal>

      {/* Pengaturan Modal */}
      <Modal
        visible={activeModal === 'settings'}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Pengaturan Aplikasi
            </Text>

            <Text style={styles.modalSub}>
              Aplikasi menggunakan Firebase Authentication
              untuk pengelolaan akun dan Cloud Firestore
              untuk penyimpanan data praktikum.
            </Text>

            <View style={styles.infoModalList}>
              <View style={styles.infoModalRow}>
                <Text style={styles.infoModalLabel}>
                  Pengembangan
                </Text>
                <Text style={styles.infoModalVal}>
                  Sprint 2
                </Text>
              </View>

              <View style={styles.infoModalRow}>
                <Text style={styles.infoModalLabel}>
                  Lingkungan
                </Text>
                <Text style={styles.infoModalVal}>
                  Expo / React Native
                </Text>
              </View>
            </View>

            <CustomButton
              title="Selesai"
              variant="primary"
              size="md"
              onPress={() => setActiveModal(null)}
            />
          </View>
        </View>
      </Modal>

      {/* Bantuan Modal */}
      <Modal
        visible={activeModal === 'help'}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Panduan Aplikasi PPK
            </Text>

            <Text style={styles.helpParagraph}>
              1. Masuk menggunakan akun yang sudah
              terdaftar di Firebase Authentication.
            </Text>

            <Text style={styles.helpParagraph}>
              2. Asisten dapat mengelola jadwal,
              membuka sesi praktikum, dan memeriksa
              data presensi sesuai kewenangannya.
            </Text>

            <Text style={styles.helpParagraph}>
              3. Praktikan dapat melihat jadwal
              dan melakukan presensi ketika sesi
              praktikum dibuka.
            </Text>

            <Text style={styles.helpParagraph}>
              4. Fitur yang tersedia mengikuti
              peran akun pengguna yang tersimpan
              di Cloud Firestore.
            </Text>

            <CustomButton
              title="Mengerti"
              variant="primary"
              size="md"
              style={{ marginTop: APP_SPACING.md }}
              onPress={() => setActiveModal(null)}
            />
          </View>
        </View>
      </Modal>

      <BottomNavigation
        role={activeRole}
        activeTab="Profile"
        onTabChange={(tabKey) =>
          navigation.navigate(tabKey)
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: APP_SPACING.lg,
    paddingTop: APP_SPACING.md,
    paddingBottom: APP_SPACING.xl,
  },
  profileCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: APP_SPACING.xxl,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.lg,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: APP_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: APP_SPACING.md,
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '700',
    color: APP_COLORS.white,
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
    marginBottom: 4,
  },
  userRoleText: {
    fontSize: 13,
    color: APP_COLORS.textSecondary,
    marginBottom: 2,
  },
  departmentText: {
    fontSize: 12,
    color: APP_COLORS.textMuted,
  },
  menuList: {
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: APP_SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: APP_COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_SPACING.md,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: APP_COLORS.navyHeading,
  },
  resetItem: {
    borderBottomWidth: 0,
  },
  resetIconBox: {
    backgroundColor: '#FEF2F2',
  },
  resetLabel: {
    color: APP_COLORS.danger,
  },
  disabledItem: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: APP_SPACING.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: APP_COLORS.white,
    borderRadius: APP_RADIUS.modal,
    padding: APP_SPACING.xl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: APP_COLORS.navyHeading,
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 13,
    color: APP_COLORS.textSecondary,
    marginBottom: APP_SPACING.md,
  },
  infoModalList: {
    gap: APP_SPACING.sm,
    marginBottom: APP_SPACING.lg,
  },
  infoModalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoModalLabel: {
    fontSize: 13,
    color: APP_COLORS.textSecondary,
    flexShrink: 1,
    marginRight: 12,
  },
  infoModalVal: {
    fontSize: 13,
    fontWeight: '600',
    color: APP_COLORS.navyHeading,
    flexShrink: 1,
    textAlign: 'right',
  },
  helpParagraph: {
    fontSize: 13,
    color: APP_COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: 10,
  },
  pressed: {
    backgroundColor: '#F8FAFC',
  },
});

export default ProfileScreen;
