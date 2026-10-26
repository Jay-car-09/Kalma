import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/components/Screen';

export default function HomeScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('home.title')}>
      <EmptyState message={t('home.empty')} />
    </Screen>
  );
}
