import type { TFunction } from 'i18next';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert, AppState } from 'react-native';

import { notifications, onRemindersHealthChange, remindersHealthy } from './notifications';
import { ensureChannel, requestReminderSync } from './sync';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/**
 * Asks for notification permission the first time it's needed, after a one-line explanation.
 * Does nothing once the user has answered (allowed or not) — Settings handles "denied".
 * Never throws: a failure here must not undo the save that triggered it.
 */
export async function askReminderPermission(t: TFunction): Promise<void> {
  const api = notifications();
  if (!api) return;
  try {
    if ((await api.getPermissionsAsync()).status !== 'undetermined') return;
  } catch (error) {
    console.warn('[reminders] permission check failed', error);
    return;
  }
  await new Promise<void>((resolve) =>
    Alert.alert(
      t('reminders.permissionTitle'),
      t('reminders.permissionMessage'),
      [
        { text: t('common.notNow'), style: 'cancel', onPress: () => resolve() },
        {
          text: t('common.continue'),
          onPress: async () => {
            try {
              await ensureChannel(); // Android shows no prompt until a channel exists
              await api.requestPermissionsAsync();
            } catch (error) {
              console.warn('[reminders] permission request failed', error);
            }
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
    const check = () =>
      notifications()
        ?.getPermissionsAsync()
        .then((p) => setState(p.status as PermissionState))
        .catch((error) => console.warn('[reminders] permission check failed', error));
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

/** False when the reminders engine couldn't load or its last sync failed. */
export function useRemindersHealthy(): boolean {
  return useSyncExternalStore(onRemindersHealthChange, remindersHealthy);
}
