import type { TFunction } from 'i18next';

import type { Tracker } from '@/data/trackers';
import { formatPeso } from '@/lib/money';

import type { PlannedReminder } from './plan';

// Notification wording, keyed by tracker module. [HOOK] A future module adds one entry
// with its own wording; the planner and sync stay unchanged.

export type ReminderMessageInput = {
  tracker: Tracker;
  reminder: PlannedReminder;
  t: TFunction;
  showAmounts: boolean;
};

export type ReminderMessage = (input: ReminderMessageInput) => { title: string; body: string };

function debtMessage({ tracker, reminder, t, showAmounts }: ReminderMessageInput) {
  const expected = tracker.direction === 'owed_to_me';
  const { days } = reminder;
  // "1" has its own line: Tagalog plural rules lump 1–3 together, so _one can't mean "exactly one".
  const key =
    days < -1 ? (expected ? 'expectedIn' : 'dueIn')
    : days === -1 ? (expected ? 'expectedTomorrow' : 'dueTomorrow')
    : days === 0 ? (expected ? 'expectedToday' : 'dueToday')
    : days === 1 ? (expected ? 'wasExpectedYesterday' : 'wasDueYesterday')
    : expected ? 'wasExpected' : 'wasDue';
  const body = t(`reminders.debt.${key}`, { count: Math.abs(days) });
  // Amounts stay off the lock screen unless the user turns them on.
  return { title: tracker.name, body: showAmounts ? `${body} · ${formatPeso(tracker.amountCentavos)}` : body };
}

export const reminderMessages: Record<string, ReminderMessage> = {
  debt: debtMessage,
};
