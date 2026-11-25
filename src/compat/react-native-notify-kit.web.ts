export const AndroidImportance = {
  NONE: 0,
  MIN: 1,
  LOW: 2,
  DEFAULT: 3,
  HIGH: 4,
  MAX: 5,
};

export const AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2,
};

export const EventType = {
  DISMISSED: 0,
  PRESS: 1,
  ACTION_PRESS: 2,
  DELIVERED: 3,
  APP_BLOCKED: 4,
  CHANNEL_BLOCKED: 5,
  CHANNEL_GROUP_BLOCKED: 6,
  TRIGGER_NOTIFICATION_CREATED: 7,
};

const notifee = {
  createChannel: async () => {},
  getNotificationSettings: async () => ({ authorizationStatus: -1 }),
  requestPermission: async () => ({ authorizationStatus: -1 }),
  openNotificationSettings: async () => {},
  displayNotification: async () => '',
  onForegroundEvent: () => () => {},
  onBackgroundEvent: () => () => {},
  getInitialNotification: async () => null,
};

export default notifee;
