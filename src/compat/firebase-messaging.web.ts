export const AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2,
};

export const getMessaging = () => null;
export const getInitialNotification = async () => null;
export const getToken = async () => '';
export const hasPermission = async () => -1;
export const isDeviceRegisteredForRemoteMessages = () => false;
export const onMessage = () => () => {};
export const onNotificationOpenedApp = () => () => {};
export const onTokenRefresh = () => () => {};
export const registerDeviceForRemoteMessages = async () => {};
export const requestPermission = async () => 0;
export const setBackgroundMessageHandler = () => {};

export type Messaging = any;
export type RemoteMessage = any;

const messaging = {
  getMessaging,
};

export default messaging;
