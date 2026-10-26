import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useIsPaid } from '@/settings/tier';
import { adBanner, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { AppText } from './AppText';

// Placeholder for the Free-tier banner (320×50). AdMob replaces the inner box in Phase 3.
export function AdBanner() {
  const isPaid = useIsPaid();
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (isPaid) return null;

  return (
    <View style={[styles.row, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
      <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppText variant="caption" tone="tertiary">
          {t('ad.label')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  box: {
    width: adBanner.width,
    height: adBanner.height,
    maxWidth: '100%',
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
