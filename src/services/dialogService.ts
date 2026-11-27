/**
 * Dialog lintas platform.
 * `Alert.alert` milik React Native tidak berfungsi di web (react-native-web),
 * sehingga tombol yang bergantung padanya tampak "mati". Helper ini memakai
 * window.confirm / window.alert di web dan Alert.alert di Android/iOS.
 */
import { Alert, Platform } from 'react-native';

export function showMessage(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
    return;
  }
  Alert.alert(title, message);
}

export function confirmAction(options: {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}): void {
  const { title, message, confirmText, cancelText = 'Batal', destructive, onConfirm } = options;

  if (Platform.OS === 'web') {
    const accepted =
      typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`);
    if (accepted) void onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    {
      text: confirmText,
      style: destructive ? 'destructive' : 'default',
      onPress: () => {
        void onConfirm();
      },
    },
  ]);
}
