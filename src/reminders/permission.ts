import * as Notifications from 'expo-notifications';
import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';

import { requestReminderSync } from './sync';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/**
 * Asks for notification permission the first time it's needed, after a one-line explanation.
 * Does nothing once the user has answered (allowed or not) — Settings handles "denied".
 */
export async function askReminderPermission(t: TFunction): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'undetermined') return;
  await new Promise<void>((resolve) =>
    Alert.alert(
      t('reminders.permissionTitle'),
      t('reminders.permissionMessage'),
      [
        { text: t('common.notNow'), style: 'cancel', onPress: () => resolve() },
        {
          text: t('common.continue'),
          onPress: async () => {
            await Notifications.requestPermissionsAsync();
            changed();
            requestReminderSync();
            resolve();
          },
        },
      ],
      { cancelable: false },
    ),
  );
}

/** Current permission; re-checked when the app returns to the foreground (e.g. from phone settings). */
export function useNotificationPermission(): PermissionState | undefined {
  const [state, setState] = useState<PermissionState>();
  useEffect(() => {
    const check = () => Notifications.getPermissionsAsync().then((p) => setState(p.status as PermissionState));
    check();
    listeners.add(check);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      listeners.delete(check);
      sub.remove();
    };
  }, []);
  return state;
}
