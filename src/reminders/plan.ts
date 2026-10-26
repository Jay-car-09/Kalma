import { getLimits } from '@/data/limits';
import type { Urgency } from '@/data/trackers';
import { addDays, fromLocalDate } from '@/lib/dates';
import { nextOccurrence, previousOccurrence, type Recurrence } from '@/lib/recurrence';

// The reminders planner (docs/reminders.md). PURE: no phone, no database, no clock of its own —
// same inputs, same plan. syncReminders() is the only part that touches the phone. [HOOK]

export type ReminderKind = 'before_due' | 'due_day' | 'overdue';

/** Any tracker row from any module (the shared `trackers` columns). */
export type ReminderTracker = {
  id: string;
  dueDate: string;
  recurrence: Recurrence;
  urgency: Urgency;
  notify: boolean;
  status: string;
  deletedAt?: string | null;
};

export type PlannedReminder = {
  trackerId: string;
  /** ISO timestamp. */
  fireAt: string;
  kind: ReminderKind;
  /** The occurrence this reminder is about. */
  dueDate: string;
  /** Fire day minus due day: −3 = "due in 3 days", 0 = due today, 1 = "was due yesterday". */
  days: number;
};

export type ReminderSettings = { reminderTime: string /* 'HH:MM', local */ };

/** Days before / after a due date, per urgency (CLAUDE.md §4). */
const OFFSETS: Record<Urgency, { before: number[]; overdue: number[] }> = {
  low: { before: [], overdue: [1] },
  normal: { before: [3], overdue: [1, 3] },
  high: { before: [7, 3, 1], overdue: [1, 2, 3, 4, 5, 6, 7] },
};

/** Plan future occurrences this far ahead, so reminders arrive even if the app isn't opened. */
export const HORIZON_DAYS = 60;
/** iOS keeps at most 64 pending notifications per app; stay under it. */
export const MAX_REMINDERS = 60;

export function planReminders(
  trackers: ReminderTracker[],
  now: Date,
  settings: ReminderSettings,
  isPaid: boolean,
): PlannedReminder[] {
  const [hour, minute] = settings.reminderTime.split(':').map(Number);
  const horizon = addDays(fromLocalDate(now), HORIZON_DAYS);
  const fireTime = (date: string) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d, hour, minute);
  };

  // Free safety net: at most 5 notified trackers, earliest due first (CLAUDE.md §5).
  const eligible = trackers
    .filter((t) => t.notify && t.status === 'active' && !t.deletedAt)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id))
    .slice(0, getLimits(isPaid).notified);

  const plan: PlannedReminder[] = [];
  for (const tracker of eligible) {
    const { before, overdue } = OFFSETS[tracker.urgency];
    let previous = previousOccurrence(tracker.recurrence, tracker.dueDate);

    for (
      let due: string | null = tracker.dueDate, current = true;
      due !== null && due <= horizon;
      previous = due, due = nextOccurrence(tracker.recurrence, due), current = false
    ) {
      const add = (days: number, kind: ReminderKind) => {
        const date = addDays(due!, days);
        // Short intervals: "due in 7 days" can't come before the previous due date has passed.
        if (kind === 'before_due' && previous !== null && date <= previous) return;
        const fireAt = fireTime(date);
        if (fireAt <= now) return;
        plan.push({ trackerId: tracker.id, fireAt: fireAt.toISOString(), kind, dueDate: due!, days });
      };
      before.forEach((n) => add(-n, 'before_due'));
      add(0, 'due_day');
      // Overdue nudges only for the current unpaid due date.
      if (current) overdue.forEach((n) => add(n, 'overdue'));
    }
  }

  return plan.sort((a, b) => a.fireAt.localeCompare(b.fireAt)).slice(0, MAX_REMINDERS);
}
