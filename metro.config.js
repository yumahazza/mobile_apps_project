const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const webAliases = {
  '@react-native-firebase/app': path.resolve(__dirname, 'src/compat/firebase-app.web.ts'),
  '@react-native-firebase/auth': path.resolve(__dirname, 'src/compat/firebase-auth.web.ts'),
  '@react-native-firebase/firestore': path.resolve(__dirname, 'src/compat/firebase-firestore.web.ts'),
  '@react-native-firebase/messaging': path.resolve(__dirname, 'src/compat/firebase-messaging.web.ts'),
  'react-native-notify-kit': path.resolve(__dirname, 'src/compat/react-native-notify-kit.web.ts'),
  '@/services/pushNotificationService': path.resolve(__dirname, 'src/services/pushNotificationService.web.ts'),
};

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webAliases[moduleName]) {
    return {
      filePath: webAliases[moduleName],
      type: 'sourceFile',
    };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
