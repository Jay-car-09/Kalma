import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { ActionRow } from '@/components/SettingsList';

import { checkCloudConnection } from './check';

// Development-only: lets the owner confirm the app can reach Supabase (Phase 2B).
export function CloudCheckRow() {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);

  async function onPress() {
    setChecking(true);
    const { result, code } = await checkCloudConnection();
    setChecking(false);
    if (result === 'connected') Alert.alert(t('cloud.connected'), t('cloud.connectedHint'));
    else Alert.alert(t('cloud.notReady'), t(`cloud.${result}`, { code }));
  }

  return <ActionRow label={t('cloud.check')} icon="cloud-outline" disabled={checking} onPress={onPress} />;
}
