import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/components/Screen';

export default function TrackersScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('trackers.title')}>
      <EmptyState message={t('trackers.empty')} />
    </Screen>
  );
}
