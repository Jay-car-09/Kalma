import type * as ExpoNotifications from 'expo-notifications';

// The ONLY place that loads expo-notifications.
//
// Why deep imports: the package entry ('expo-notifications') also loads its push-topic module,
// whose native half Expo Go on Android doesn't ship ("Cannot find native module
// 'ExpoTopicSubscriptionModule'"), and that throw at import stopped the whole app loading.
// Kalma only uses local notifications, so it loads just those files — lazily, inside
// try/catch, so a missing native piece turns reminders off instead of breaking startup.

export type NotificationsApi = {
  getPermissionsAsync: typeof ExpoNotifications.getPermissionsAsync;
  requestPermissionsAsync: typeof ExpoNotifications.requestPermissionsAsync;
  setNotificationChannelAsync: typeof ExpoNotifications.setNotificationChannelAsync;
  scheduleNotificationAsync: typeof ExpoNotifications.scheduleNotificationAsync;
  cancelScheduledNotificationAsync: typeof ExpoNotifications.cancelScheduledNotificationAsync;
  getAllScheduledNotificationsAsync: typeof ExpoNotifications.getAllScheduledNotificationsAsync;
  setNotificationHandler: typeof ExpoNotifications.setNotificationHandler;
  addNotificationResponseReceivedListener: typeof ExpoNotifications.addNotificationResponseReceivedListener;
  getLastNotificationResponse: typeof ExpoNotifications.getLastNotificationResponse;
  clearLastNotificationResponse: typeof ExpoNotifications.clearLastNotificationResponse;
  SchedulableTriggerInputTypes: typeof ExpoNotifications.SchedulableTriggerInputTypes;
  AndroidImportance: typeof ExpoNotifications.AndroidImportance;
};

let api: NotificationsApi | null | undefined;

/** The notifications API, or null if this phone/app can't provide it (the error is logged once). */
export function notifications(): NotificationsApi | null {
  if (api !== undefined) return api;
  try {
    const permissions = require('expo-notifications/build/NotificationPermissions');
    const emitter = require('expo-notifications/build/NotificationsEmitter');
    api = {
      getPermissionsAsync: permissions.getPermissionsAsync,
      requestPermissionsAsync: permissions.requestPermissionsAsync,
      setNotificationChannelAsync: require('expo-notifications/build/setNotificationChannelAsync')
        .setNotificationChannelAsync,
      scheduleNotificationAsync: require('expo-notifications/build/scheduleNotificationAsync').scheduleNotificationAsync,
      cancelScheduledNotificationAsync: require('expo-notifications/build/cancelScheduledNotificationAsync')
        .cancelScheduledNotificationAsync,
      getAllScheduledNotificationsAsync: require('expo-notifications/build/getAllScheduledNotificationsAsync')
        .getAllScheduledNotificationsAsync,
      setNotificationHandler: require('expo-notifications/build/NotificationsHandler').setNotificationHandler,
      addNotificationResponseReceivedListener: emitter.addNotificationResponseReceivedListener,
      getLastNotificationResponse: emitter.getLastNotificationResponse,
      clearLastNotificationResponse: emitter.clearLastNotificationResponse,
      SchedulableTriggerInputTypes: require('expo-notifications/build/Notifications.types').SchedulableTriggerInputTypes,
      AndroidImportance: require('expo-notifications/build/NotificationChannelManager.types').AndroidImportance,
    };
    // While the app is open, show reminders as a quiet banner (no sound).
    api.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch (error) {
    console.warn('[reminders] notifications unavailable on this device', error);
    reportRemindersHealth(false);
    api = null;
  }
  return api;
}

// Health signal for Settings: false after a load or sync failure, true after a good sync.
let healthy = true;
const healthListeners = new Set<() => void>();

export function reportRemindersHealth(ok: boolean) {
  if (healthy === ok) return;
  healthy = ok;
  healthListeners.forEach((l) => l());
}

export function remindersHealthy(): boolean {
  return healthy;
}

export function onRemindersHealthChange(listener: () => void): () => void {
  healthListeners.add(listener);
  return () => healthListeners.delete(listener);
}
