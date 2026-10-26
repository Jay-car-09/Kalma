import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { loadDashboard } from '@/data/dashboard';
import { useQuery } from '@/data/useQuery';
import { dashboardCards } from '@/dashboard/registry';
import { formatMonth, today } from '@/lib/dates';
import { spacing } from '@/theme/tokens';

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  // Recalculates whenever Home comes into focus, and after any change.
  const result = useQuery(loadDashboard, []);
  const title = formatMonth(result?.dashboard.month ?? today(), i18n.language);

  if (!result) return <Screen title={title} />;

  if (!result.hasTrackers) {
    return (
      <Screen title={title}>
        <View style={styles.welcome}>
          <AppText tone="secondary" style={styles.center}>
            {t('home.welcome')}
          </AppText>
          <Button label={t('home.addFirst')} onPress={() => router.push('/tracker-sheet')} />
        </View>
      </Screen>
    );
  }

  const { dashboard } = result;
  const visible = dashboardCards.filter((card) => !card.hidden?.(dashboard));
  const insights = visible.filter((card) => card.section === 'insights');

  return (
    <Screen title={title}>
      {visible
        .filter((card) => card.section === 'main')
        .map(({ id, Component }) => (
          <Component key={id} data={dashboard} />
        ))}
      {insights.length > 0 && (
        <View style={styles.insights}>
          <AppText variant="heading">{t('home.insights')}</AppText>
          {insights.map(({ id, Component }) => (
            <Component key={id} data={dashboard} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcome: { flex: 1, justifyContent: 'center', gap: spacing.xl, paddingBottom: spacing.xxxl },
  center: { textAlign: 'center' },
  insights: { gap: spacing.md },
});
