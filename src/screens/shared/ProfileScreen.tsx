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
  APP_FONTS,
  APP_RADIUS,
  APP_SHADOWS,
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

  const initials = (activeUser.name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const handleLogout = () => {
    if (loggingOut) return;

    Alert.alert(
      'Logout',
      'Keluar dari akun ini?',
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
      edges={['top', 'left', 'right']}>
      <AppHeader
        title="Profil"
        onBack={() => navigation.goBack()}
        onNotificationPress={() =>
          navigation.navigate('Notifications')
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Card style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{initials}</Text>
          </View>

          <Text style={styles.userNameText}>{activeUser.name}</Text>

          <Text style={styles.userRoleText}>
            {activeRole === 'assistant'
              ? 'Asisten Praktikum'
              : `Praktikan · NIM ${activeUser.nim || '-'}`}
          </Text>

          {activeUser.department ? (
            <Text style={styles.departmentText}>{activeUser.department}</Text>
          ) : null}
        </Card>

        <View style={styles.menuList}>
          <Pressable
            onPress={() => setActiveModal('info')}
            style={({ pressed }) => [
              styles.menuItem,
              pressed && styles.pressed,
            ]}>
            <View style={styles.menuLeft}>
              <View style={styles.menuIconBox}>
                <Ionicons
                  name="person-outline"
                  size={19}
                  color={APP_COLORS.primary}
                />
              </View>
              <Text style={styles.menuLabel}>Informasi Akun</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={APP_COLORS.textMuted}
            />
          </Pressable>

          {activeRole === 'assistant' ? (
            <Pressable
              onPress={() =>
                navigation.navigate('LaboratoryManagement', {
                  fromTab: 'Profile',
                })
              }
              style={({ pressed }) => [
                styles.menuItem,
                pressed && styles.pressed,
              ]}>
              <View style={styles.menuLeft}>
                <View style={styles.menuIconBox}>
                  <Ionicons
                    name="location-outline"
                    size={19}
                    color={APP_COLORS.primary}
                  />
                </View>
                <Text style={styles.menuLabel}>Lokasi Laboratorium</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={APP_COLORS.textMuted}
              />
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setActiveModal('settings')}
            style={({ pressed }) => [
              styles.menuItem,
              pressed && styles.pressed,
            ]}>
            <View style={styles.menuLeft}>
              <View style={styles.menuIconBox}>
                <Ionicons
                  name="settings-outline"
                  size={19}
                  color={APP_COLORS.primary}
                />
              </View>
              <Text style={styles.menuLabel}>Pengaturan</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={APP_COLORS.textMuted}
            />
          </Pressable>

          <Pressable
            onPress={() => setActiveModal('help')}
            style={({ pressed }) => [
              styles.menuItem,
              pressed && styles.pressed,
            ]}>
            <View style={styles.menuLeft}>
              <View style={styles.menuIconBox}>
                <Ionicons
                  name="help-circle-outline"
                  size={19}
                  color={APP_COLORS.primary}
                />
              </View>
              <Text style={styles.menuLabel}>Bantuan</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={APP_COLORS.textMuted}
            />
          </Pressable>

          <Pressable
            onPress={handleLogout}
            disabled={loggingOut}
            style={({ pressed }) => [
              styles.menuItem,
              styles.resetItem,
              pressed && styles.pressed,
              loggingOut && styles.disabledItem,
            ]}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, styles.resetIconBox]}>
                <Ionicons
                  name="log-out-outline"
                  size={19}
                  color={APP_COLORS.danger}
                />
              </View>

              <Text style={[styles.menuLabel, styles.resetLabel]}>
                {loggingOut ? 'Sedang logout...' : 'Logout'}
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
        onRequestClose={() => setActiveModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, APP_SHADOWS.modal]}>
            <Text style={styles.modalTitle}>Informasi Akun</Text>

            <View style={styles.infoModalList}>
              <View style={styles.infoModalRow}>
                <Text style={styles.infoModalLabel}>Nama Lengkap</Text>
                <Text style={styles.infoModalVal}>{activeUser.name}</Text>
              </View>

              <View style={styles.infoModalRow}>
                <Text style={styles.infoModalLabel}>Peran</Text>
                <Text style={styles.infoModalVal}>
                  {activeRole === 'assistant' ? 'Asisten Praktikum' : 'Praktikan'}
                </Text>
              </View>

              {activeUser.nim ? (
                <View style={styles.infoModalRow}>
                  <Text style={styles.infoModalLabel}>NIM</Text>
                  <Text style={styles.infoModalVal}>{activeUser.nim}</Text>
                </View>
              ) : null}

              <View style={styles.infoModalRow}>
                <Text style={styles.infoModalLabel}>Email</Text>
                <Text style={styles.infoModalVal}>{activeUser.email || '-'}</Text>
              </View>

              <View style={[styles.infoModalRow, styles.lastModalRow]}>
                <Text style={styles.infoModalLabel}>Departemen</Text>
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
        onRequestClose={() => setActiveModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, APP_SHADOWS.modal]}>
            <Text style={styles.modalTitle}>Pengaturan</Text>
            <Text style={styles.modalSub}>
              Akun dan data praktikum disinkronkan secara real-time.
            </Text>

            <View style={styles.infoModalList}>
              <View style={styles.infoModalRow}>
                <Text style={styles.infoModalLabel}>Versi</Text>
                <Text style={styles.infoModalVal}>1.0.0</Text>
              </View>

              <View style={[styles.infoModalRow, styles.lastModalRow]}>
                <Text style={styles.infoModalLabel}>Platform</Text>
                <Text style={styles.infoModalVal}>Expo / React Native</Text>
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
        onRequestClose={() => setActiveModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, APP_SHADOWS.modal]}>
            <Text style={styles.modalTitle}>Panduan Penggunaan</Text>

            <Text style={styles.helpParagraph}>
              1. Masuk menggunakan akun terdaftar.
            </Text>
            <Text style={styles.helpParagraph}>
              2. Asisten mengelola jadwal, membuka sesi, memeriksa izin, dan melihat ulasan AI.
            </Text>
            <Text style={styles.helpParagraph}>
              3. Praktikan melakukan presensi saat sesi dibuka, mengajukan izin, dan mengirim ulasan setelah sesi selesai.
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
        onTabChange={(tabKey) => navigation.navigate(tabKey)}
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
    paddingTop: APP_SPACING.xs,
    paddingBottom: APP_SPACING.xxl,
  },
  profileCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: APP_SPACING.xl,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    marginBottom: APP_SPACING.lg,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: APP_COLORS.nordicBreeze,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: APP_SPACING.md,
  },
  avatarInitial: {
    fontFamily: APP_FONTS.bold,
    fontSize: 22,
    color: APP_COLORS.tetsuKon,
  },
  userNameText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 18,
    color: APP_COLORS.inkPrimary,
    marginBottom: 2,
  },
  userRoleText: {
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
    marginBottom: 2,
  },
  departmentText: {
    fontFamily: APP_FONTS.regular,
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
    minHeight: 54,
    paddingVertical: 12,
    paddingHorizontal: APP_SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.divider,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: APP_COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_SPACING.md,
  },
  menuLabel: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
  },
  resetItem: {
    borderBottomWidth: 0,
  },
  resetIconBox: {
    backgroundColor: APP_COLORS.dangerSoft,
  },
  resetLabel: {
    color: APP_COLORS.dangerText,
  },
  disabledItem: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 24, 75, 0.5)',
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
    fontFamily: APP_FONTS.bold,
    fontSize: 18,
    color: APP_COLORS.inkPrimary,
    marginBottom: 8,
  },
  modalSub: {
    fontFamily: APP_FONTS.regular,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
    lineHeight: 19,
    marginBottom: APP_SPACING.md,
  },
  infoModalList: {
    marginBottom: APP_SPACING.lg,
  },
  infoModalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.divider,
  },
  lastModalRow: {
    borderBottomWidth: 0,
  },
  infoModalLabel: {
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
    flexShrink: 1,
    marginRight: 12,
  },
  infoModalVal: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 13,
    color: APP_COLORS.inkPrimary,
    flexShrink: 1,
    textAlign: 'right',
  },
  helpParagraph: {
    fontFamily: APP_FONTS.regular,
    fontSize: 13,
    color: APP_COLORS.inkPrimary,
    lineHeight: 20,
    marginBottom: 8,
  },
  pressed: {
    backgroundColor: APP_COLORS.surfaceSubtle,
  },
});

export default ProfileScreen;
