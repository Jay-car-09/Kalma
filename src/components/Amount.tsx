import { StyleSheet } from 'react-native';

import { formatPeso } from '@/lib/money';

import { AppText, type AppTextProps } from './AppText';

type AmountProps = Omit<AppTextProps, 'children'> & {
  value: number;
};

// The one way to show money: ₱2,450.00 with tabular numbers so columns line up.
export function Amount({ value, style, ...rest }: AmountProps) {
  return (
    <AppText style={[styles.tabular, style]} {...rest}>
      {formatPeso(value)}
    </AppText>
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] },
});
