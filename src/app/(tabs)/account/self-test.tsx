import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  attackTestRow,
  cleanUpTestRow,
  createTestRow,
  loadSelfTest,
  saveSelfTest,
  verdictOf,
  type SelfTest,
} from '@/cloud/selfTest';
import { useSession } from '@/cloud/session';
import { getSupabase } from '@/cloud/supabase';
import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { ActionRow, SettingsSection } from '@/components/SettingsList';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

// Dev-only: proves account B can't read, change or delete account A's cloud rows (accounts-security §3.2).
export default function SelfTestScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useSession();
  const [test, setTest] = useState<SelfTest | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSelfTest().then(setTest);
    }, []),
  );

  if (!__DEV__) return <Redirect href="/account" />;

  async function run(step: () => Promise<string[]>) {
    setBusy(true);
    try {
      setLines(await step());
    } catch {
      setLines([t('selfTest.failed')]);
    } finally {
      setBusy(false);
    }
  }

  async function update(next: SelfTest | null) {
    await saveSelfTest(next);
    setTest(next);
  }

  const create = () =>
    run(async () => {
      if (!user) return [t('selfTest.signInFirst')];
      if (test) return [t('selfTest.alreadyCreated')];
      await update({ trackerId: await createTestRow(user.id), ownerId: user.id });
      return [t('selfTest.created')];
    });

  // shortcut: signs out without the 2E safeguards; fine while sign-in never touches local data (until 2D).
  const switchAccount = () =>
    run(async () => {
      await getSupabase().auth.signOut({ scope: 'local' });
      router.push('/account/sign-in');
      return [];
    });

  const attack = () =>
    run(async () => {
      if (!test) return [t('selfTest.noTest')];
      if (!user || user.id === test.ownerId) return [t('selfTest.needB')];
      const result = await attackTestRow(test.trackerId);
      const verdict = verdictOf(result);
      if (verdict !== 'incomplete') await update({ ...test, verdict });
      return [
        t('selfTest.read', { result: t(`selfTest.attempt.${result.read}`) }),
        t('selfTest.change', { result: t(`selfTest.attempt.${result.change}`) }),
        t('selfTest.remove', { result: t(`selfTest.attempt.${result.remove}`) }),
        t(`selfTest.${verdict}`),
      ];
    });

  const cleanUp = () =>
    run(async () => {
      if (!test) return [t('selfTest.noTest')];
      if (!user || user.id !== test.ownerId) return [t('selfTest.needA')];
      const outcome = await cleanUpTestRow(test.trackerId);
      await update(null);
      return [t(`selfTest.${outcome}`)];
    });

  return (
    <Screen title={t('selfTest.title')} onBack={router.back}>
      <AppText tone="secondary">{t('selfTest.intro')}</AppText>
      <View style={styles.status}>
        <AppText>{user ? t('selfTest.signedInAs', { email: user.email }) : t('selfTest.signInFirst')}</AppText>
        {test?.verdict && <AppText tone="secondary">{t(`selfTest.last.${test.verdict}`)}</AppText>}
      </View>

      <SettingsSection title={t('selfTest.steps')}>
        <ActionRow label={t('selfTest.step1')} icon="add-circle-outline" disabled={busy} onPress={create} />
        <ActionRow label={t('selfTest.step2')} icon="swap-horizontal-outline" disabled={busy} onPress={switchAccount} />
        <ActionRow label={t('selfTest.step3')} icon="shield-outline" disabled={busy} onPress={attack} />
        <ActionRow label={t('selfTest.step4')} icon="trash-outline" disabled={busy} onPress={cleanUp} />
      </SettingsSection>

      {lines.length > 0 && (
        <View style={[styles.results, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {lines.map((line, i) => (
            <AppText key={i}>{line}</AppText>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { gap: spacing.xs },
  results: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
});
