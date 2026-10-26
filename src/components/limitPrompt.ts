import type { TFunction } from 'i18next';
import { Alert } from 'react-native';

import { getLimits, type LimitKind } from '@/data/limits';

// Calm, one-button prompt when a Free limit blocks an action (CLAUDE.md §5).
// shortcut: no Upgrade button until purchases exist in Phase 3; the message names both ways out.
export function showLimitPrompt(kind: LimitKind, t: TFunction) {
  const limit = getLimits(false)[kind];
  Alert.alert(t(`limits.${kind}.title`, { limit }), t(`limits.${kind}.message`, { limit }), [
    { text: t('common.ok') },
  ]);
}
