import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatDate, fromLocalDate, toLocalDate } from '@/lib/dates';
import { screenPadding, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { AppText } from './AppText';
import { Chips } from './Chips';

type SheetProps = {
  title: string;
  onSave: () => void;
  saving?: boolean;
  /** Children render once this is true (e.g. after loading the record being edited). */
  ready?: boolean;
  children: ReactNode;
};

// Modal form frame: Cancel · title · Save, then a keyboard-aware scrolling body.
export function Sheet({ title, onSave, saving = false, ready = true, children }: SheetProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const disabled = saving || !ready;
  return (
    <SafeAreaView
      // iOS modals are page sheets that already sit below the status bar.
      edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']}
      style={[styles.fill, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={spacing.md} accessibilityRole="button">
          <AppText tone="secondary">{t('common.cancel')}</AppText>
        </Pressable>
        <AppText variant="heading" style={styles.title} numberOfLines={1}>
          {title}
        </AppText>
        <Pressable
          onPress={onSave}
          disabled={disabled}
          hitSlop={spacing.md}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          style={disabled && styles.dim}>
          <AppText variant="heading">{t('common.save')}</AppText>
        </Pressable>
      </View>
      {ready && (
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      {children}
    </View>
  );
}

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (date: string) => void;
  /** Quick-pick chips shown before "Pick a date". */
  quick: { label: string; date: string }[];
  maximumDate?: string;
};

// Quick-pick chips plus the phone's date picker (inline on iPhone, a dialog on Android).
export function DateField({ label, value, onChange, quick, maximumDate }: DateFieldProps) {
  const { t, i18n } = useTranslation();
  const { colors, scheme } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const selected = quick.find((q) => q.date === value)?.date ?? 'pick';

  return (
    <Field label={label}>
      <Chips
        options={[
          ...quick.map((q) => ({ value: q.date, label: q.label })),
          { value: 'pick', label: selected === 'pick' ? formatDate(value, i18n.language) : t('form.pickDate') },
        ]}
        value={selected}
        onChange={(chosen) => {
          if (chosen === 'pick') {
            setPickerOpen((open) => !open);
            return;
          }
          setPickerOpen(false);
          onChange(chosen);
        }}
      />
      {pickerOpen && (
        <DateTimePicker
          value={toLocalDate(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          maximumDate={maximumDate ? toLocalDate(maximumDate) : undefined}
          themeVariant={scheme}
          accentColor={colors.textPrimary}
          onValueChange={(_, date) => {
            onChange(fromLocalDate(date));
            if (Platform.OS === 'android') setPickerOpen(false);
          }}
          onDismiss={() => setPickerOpen(false)}
        />
      )}
    </Field>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, textAlign: 'center' },
  content: { padding: screenPadding, gap: spacing.xl, paddingBottom: spacing.xxxl },
  field: { gap: spacing.sm },
  dim: { opacity: 0.5 },
});
