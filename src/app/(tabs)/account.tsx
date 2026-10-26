import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/components/Screen';

export default function AccountScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('account.title')}>
      <EmptyState message={t('account.empty')} />
    </Screen>
  );
}
