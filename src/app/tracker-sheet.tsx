import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { AppText } from '@/components/AppText';
import { Chips } from '@/components/Chips';
import { showLimitPrompt } from '@/components/limitPrompt';
import { SwitchRow } from '@/components/SettingsList';
import { DateField, Field, Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { getLimits, LimitError } from '@/data/limits';
import {
  createTracker,
  DEBT_TYPES,
  getTracker,
  getUsage,
  listTrackerNames,
  updateTracker,
  type DebtType,
  type Direction,
  type InterestPeriod,
  type Tracker,
  type TrackerInput,
  type TrackerStatus,
  type Urgency,
} from '@/data/trackers';
import { addDays, today } from '@/lib/dates';
import { centavosToInput, parsePeso } from '@/lib/money';
import type { Recurrence } from '@/lib/recurrence';
import { useIsPaid } from '@/settings/tier';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Unit = 'day' | 'week' | 'month';

type Form = {
  direction: Direction;
  name: string;
  amount: string;
  debtType: DebtType;
  dueDate: string;
  repeat: Recurrence['type'];
  days: [string, string];
  every: string;
  unit: Unit;
  urgency: Urgency;
  notify: boolean;
  balance: string;
  rate: string;
  period: InterestPeriod;
  cutoff: string;
  notes: string;
};

type Errors = Partial<Record<'name' | 'amount' | 'days' | 'every' | 'balance' | 'rate' | 'cutoff', string>>;

const BLANK: Form = {
  direction: 'owe',
  name: '',
  amount: '',
  debtType: 'other',
  dueDate: '', // set to today() when the sheet opens
  repeat: 'none',
  days: ['15', '30'],
  every: '2',
  unit: 'week',
  urgency: 'normal',
  notify: false,
  balance: '',
  rate: '',
  period: 'monthly',
  cutoff: '',
  notes: '',
};

function fromTracker(tr: Tracker): Form {
  const r = tr.recurrence;
  return {
    ...BLANK,
    direction: tr.direction,
    name: tr.name,
    amount: centavosToInput(tr.amountCentavos),
    debtType: tr.debtType,
    dueDate: tr.dueDate,
    repeat: r.type,
    days: r.type === 'twice_monthly' ? [String(r.days[0]), String(r.days[1])] : BLANK.days,
    every: r.type === 'custom' ? String(r.every) : BLANK.every,
    unit: r.type === 'custom' ? r.unit : BLANK.unit,
    urgency: tr.urgency,
    notify: tr.notify,
    balance: tr.startingBalanceCentavos == null ? '' : centavosToInput(tr.startingBalanceCentavos),
    rate: tr.interestRate == null ? '' : String(tr.interestRate),
    period: tr.interestPeriod ?? 'monthly',
    cutoff: tr.statementCutoffDay == null ? '' : String(tr.statementCutoffDay),
    notes: tr.notes ?? '',
  };
}

const parseDay = (s: string) => (/^\d{1,2}$/.test(s) && +s >= 1 && +s <= 31 ? +s : null);

export default function TrackerSheet() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const isPaid = useIsPaid();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const amountRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [form, setForm] = useState<Form>(() => ({ ...BLANK, dueDate: today() }));
  const [status, setStatus] = useState<TrackerStatus>('active');
  const [names, setNames] = useState<string[]>([]);
  const [notifyAvailable, setNotifyAvailable] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const set =
    <K extends keyof Form>(key: K) =>
    (value: Form[K]) =>
      setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    Promise.all([listTrackerNames(), getUsage(), id ? getTracker(id) : null]).then(
      ([allNames, usage, tracker]) => {
        const slotFree = usage.notified < getLimits(isPaid).notified;
        setNames(allNames);
        if (tracker) {
          setForm(fromTracker(tracker));
          setStatus(tracker.status);
          setMoreOpen(
            tracker.startingBalanceCentavos != null ||
              tracker.interestRate != null ||
              tracker.statementCutoffDay != null ||
              !!tracker.notes,
          );
          // A tracker that already notifies holds its own slot.
          setNotifyAvailable(slotFree || (tracker.notify && tracker.status === 'active'));
        } else {
          // Notify defaults On when a slot is free (CLAUDE.md §4).
          setForm((f) => ({ ...f, notify: slotFree }));
          setNotifyAvailable(slotFree);
        }
        setLoaded(true);
      },
    );
  }, [id, isPaid]);

  function onNotifyChange(value: boolean) {
    if (value && !notifyAvailable) {
      showLimitPrompt('notified', t);
      return;
    }
    set('notify')(value);
  }

  function validate(): { input: TrackerInput | null; errors: Errors } {
    const e: Errors = {};
    const name = form.name.trim();
    if (!name) e.name = t('form.error.name');

    const amount = parsePeso(form.amount);
    if (!amount) e.amount = t('form.error.amount');

    let recurrence: Recurrence = { type: 'none' };
    if (form.repeat === 'weekly') recurrence = { type: 'weekly' };
    if (form.repeat === 'monthly') recurrence = { type: 'monthly', day: Number(form.dueDate.slice(8)) };
    if (form.repeat === 'twice_monthly') {
      const [a, b] = form.days.map(parseDay);
      if (a == null || b == null) e.days = t('form.error.day');
      else if (a === b) e.days = t('form.error.daysSame');
      else recurrence = { type: 'twice_monthly', days: a < b ? [a, b] : [b, a] };
    }
    if (form.repeat === 'custom') {
      const every = /^\d{1,3}$/.test(form.every) ? Number(form.every) : 0;
      if (every < 1) e.every = t('form.error.every');
      else recurrence = { type: 'custom', every, unit: form.unit };
    }

    const balance = form.balance.trim() ? parsePeso(form.balance) : null;
    if (form.balance.trim() && balance == null) e.balance = t('form.error.amount');

    const rate = form.rate.trim() ? Number(form.rate.trim()) : null;
    if (form.rate.trim() && !/^\d+(\.\d+)?$/.test(form.rate.trim())) e.rate = t('form.error.rate');

    const isCard = form.debtType === 'credit_card';
    const cutoff = isCard && form.cutoff.trim() ? parseDay(form.cutoff.trim()) : null;
    if (isCard && form.cutoff.trim() && cutoff == null) e.cutoff = t('form.error.day');

    if (Object.keys(e).length > 0 || !amount) return { input: null, errors: e };
    return {
      errors: e,
      input: {
        direction: form.direction,
        name,
        amountCentavos: amount,
        debtType: form.debtType,
        dueDate: form.dueDate,
        recurrence,
        urgency: form.urgency,
        notify: status === 'active' && form.notify,
        startingBalanceCentavos: balance,
        interestRate: rate,
        interestPeriod: rate == null ? null : form.period,
        statementCutoffDay: cutoff,
        notes: form.notes.trim() || null,
      },
    };
  }

  async function save() {
    const { input, errors: found } = validate();
    setErrors(found);
    if (found.balance || found.rate || found.cutoff) setMoreOpen(true);
    if (!input) return;

    setSaving(true);
    try {
      if (id) await updateTracker(id, input, isPaid);
      else await createTracker(input, isPaid);
      router.back();
    } catch (err) {
      if (err instanceof LimitError) {
        if (err.kind === 'notified') {
          set('notify')(false);
          setNotifyAvailable(false);
        }
        showLimitPrompt(err.kind, t);
      } else {
        // Keep the sheet open so nothing typed is lost.
        Alert.alert(t('common.errorTitle'), t('common.saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  }

  const query = form.name.trim().toLowerCase();
  const suggestions = query
    ? names.filter((n) => n.toLowerCase().startsWith(query) && n.toLowerCase() !== query).slice(0, 3)
    : [];

  return (
    <Sheet title={id ? t('form.editTitle') : t('form.addTitle')} onSave={save} saving={saving} ready={loaded}>
            <Chips
              fill
              options={(['owe', 'owed_to_me'] as const).map((value) => ({
                value,
                label: t(`tracker.direction.${value}`),
              }))}
              value={form.direction}
              onChange={set('direction')}
            />

            {/* 1 Name */}
            <View style={styles.field}>
              <TextField
                label={t('form.name')}
                placeholder={t(`form.namePlaceholder.${form.direction}`)}
                value={form.name}
                onChangeText={set('name')}
                error={errors.name}
                autoFocus={!id}
                autoCapitalize="words"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => amountRef.current?.focus()}
              />
              {suggestions.length > 0 && (
                <View style={styles.suggestions}>
                  {suggestions.map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => {
                        set('name')(n);
                        amountRef.current?.focus();
                      }}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.suggestion,
                        { borderColor: colors.border },
                        pressed && styles.dim,
                      ]}>
                      <AppText variant="caption">{n}</AppText>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* 2 Amount */}
            <TextField
              ref={amountRef}
              label={form.repeat === 'none' ? t('form.amountFull') : t('form.amountEach')}
              placeholder="0.00"
              value={form.amount}
              onChangeText={set('amount')}
              error={errors.amount}
              keyboardType="decimal-pad"
              style={styles.tabular}
            />

            {/* 3 Type */}
            <Field label={t('tracker.field.type')}>
              <Chips
                options={DEBT_TYPES.map((value) => ({ value, label: t(`tracker.type.${value}`) }))}
                value={form.debtType}
                onChange={set('debtType')}
              />
            </Field>

            {/* 4 Due date */}
            <DateField
              label={t('tracker.field.dueDate')}
              value={form.dueDate}
              onChange={set('dueDate')}
              quick={[
                { label: t('form.today'), date: today() },
                { label: t('form.tomorrow'), date: addDays(today(), 1) },
                { label: t('form.nextWeek'), date: addDays(today(), 7) },
              ]}
            />

            {/* 5 Recurring */}
            <Field label={t('tracker.field.repeat')}>
              <Chips
                options={(['none', 'weekly', 'twice_monthly', 'monthly', 'custom'] as const).map((value) => ({
                  value,
                  label: t(`tracker.repeat.${value}`),
                }))}
                value={form.repeat}
                onChange={set('repeat')}
              />
              {form.repeat === 'monthly' && (
                <AppText variant="caption" tone="secondary">
                  {t('form.monthlyHint', { day: Number(form.dueDate.slice(8)) })}
                </AppText>
              )}
              {form.repeat === 'twice_monthly' && (
                <View style={styles.inline}>
                  {[0, 1].map((i) => (
                    <View key={i} style={styles.grow}>
                      <TextField
                        label={i === 0 ? t('form.firstDay') : t('form.secondDay')}
                        value={form.days[i]}
                        onChangeText={(v) =>
                          set('days')((i === 0 ? [v, form.days[1]] : [form.days[0], v]) as [string, string])
                        }
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                    </View>
                  ))}
                </View>
              )}
              {form.repeat === 'twice_monthly' && errors.days ? (
                <AppText variant="caption">{errors.days}</AppText>
              ) : null}
              {form.repeat === 'custom' && (
                <View style={styles.field}>
                  <View style={styles.inline}>
                    <View style={styles.everyField}>
                      <TextField
                        label={t('form.every')}
                        value={form.every}
                        onChangeText={set('every')}
                        keyboardType="number-pad"
                        maxLength={3}
                        error={errors.every}
                      />
                    </View>
                  </View>
                  <Chips
                    options={(['day', 'week', 'month'] as const).map((value) => ({
                      value,
                      label: t(`form.unit.${value}`),
                    }))}
                    value={form.unit}
                    onChange={set('unit')}
                  />
                </View>
              )}
            </Field>

            {/* 6 Urgency */}
            <Field label={t('tracker.field.urgency')}>
              <Chips
                options={(['low', 'normal', 'high'] as const).map((value) => ({
                  value,
                  label: t(`tracker.urgency.${value}`),
                }))}
                value={form.urgency}
                onChange={set('urgency')}
              />
            </Field>

            {/* 7 Notify — only active trackers can notify */}
            {status === 'active' && (
              <View style={styles.field}>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <SwitchRow label={t('tracker.field.notify')} value={form.notify} onValueChange={onNotifyChange} />
                </View>
                {!notifyAvailable && (
                  <AppText variant="caption" tone="secondary">
                    {t('form.notifyFull', { limit: getLimits(false).notified })}
                  </AppText>
                )}
              </View>
            )}

            {/* More details */}
            <Pressable
              onPress={() => setMoreOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: moreOpen }}
              style={styles.moreToggle}>
              <AppText variant="heading" style={styles.grow}>
                {t('form.moreDetails')}
              </AppText>
              <Ionicons name={moreOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
            </Pressable>

            {moreOpen && (
              <>
                <TextField
                  label={t('tracker.remainingBalance')}
                  placeholder="0.00"
                  value={form.balance}
                  onChangeText={set('balance')}
                  error={errors.balance}
                  keyboardType="decimal-pad"
                  style={styles.tabular}
                />
                <View style={styles.field}>
                  <TextField
                    label={t('tracker.field.interestRate')}
                    placeholder="3.5"
                    value={form.rate}
                    onChangeText={set('rate')}
                    error={errors.rate}
                    keyboardType="decimal-pad"
                  />
                  <Chips
                    options={(['monthly', 'annual'] as const).map((value) => ({
                      value,
                      label: t(`form.period.${value}`),
                    }))}
                    value={form.period}
                    onChange={set('period')}
                  />
                </View>
                {form.debtType === 'credit_card' && (
                  <TextField
                    label={t('tracker.field.cutoff')}
                    placeholder="1–31"
                    value={form.cutoff}
                    onChangeText={set('cutoff')}
                    error={errors.cutoff}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                )}
                <TextField
                  label={t('tracker.field.notes')}
                  value={form.notes}
                  onChangeText={set('notes')}
                  multiline
                  style={styles.notes}
                />
              </>
            )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  suggestion: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inline: { flexDirection: 'row', gap: spacing.md },
  grow: { flex: 1 },
  everyField: { width: 96 },
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  moreToggle: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  notes: { minHeight: 96, textAlignVertical: 'top' },
  tabular: { fontVariant: ['tabular-nums'] },
  dim: { opacity: 0.5 },
});
