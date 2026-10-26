import type { DebtType, Direction, Tracker, Urgency } from '@/data/trackers';

import { daysInMonth, monthKey, ymd } from './dates';
import { nextOccurrence } from './recurrence';

// Dashboard figures (docs/dashboard.md). Pure: same inputs → same numbers, so they're unit-tested.

/** A Paid/Received entry (adjustments are not payments and never count here). */
export type DashboardPayment = {
  trackerId: string;
  direction: Direction;
  debtType: DebtType;
  amountCentavos: number;
  paidOn: string;
  occurrenceDueDate: string | null;
};

export type Dashboard = {
  today: string;
  month: string; // 'YYYY-MM'
  /** I-owe trackers, current calendar month. */
  dueThisMonth: { paid: number; unpaid: number };
  nextDue: Tracker | null;
  /** Oldest first. */
  overdue: Tracker[];
  /** Null when no active I-owe tracker tracks a balance. */
  totalDebt: number | null;
  owedToYou: { unpaid: number; remaining: number | null };
  /** Last 6 months, oldest first. */
  paymentsByMonth: { month: string; total: number }[];
  /** Largest first; only types with something due. */
  dueByType: { type: DebtType; total: number }[];
  onTime: { onTime: number; total: number };
  byUrgency: Record<Urgency, number>;
};

/** Unpaid occurrences of a tracker inside [start, end]: from its current due date onward (data-model §5.2). */
export function unpaidOccurrencesIn(tracker: Tracker, start: string, end: string): number {
  let count = 0;
  // shortcut: cap guards a daily tracker left unpaid for decades; real data never comes close.
  for (
    let d: string | null = tracker.dueDate, steps = 0;
    d !== null && d <= end && steps < 10_000;
    d = nextOccurrence(tracker.recurrence, d), steps++
  ) {
    if (d >= start) count++;
  }
  return count;
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/**
 * @param trackers active and done trackers (archived/deleted already excluded)
 * @param payments Paid/Received entries of those trackers
 */
export function computeDashboard(trackers: Tracker[], payments: DashboardPayment[], today: string): Dashboard {
  const [y, m] = today.split('-').map(Number);
  const start = ymd(y, m, 1);
  const end = ymd(y, m, daysInMonth(y, m));
  const inMonth = (date: string | null) => date !== null && date >= start && date <= end;

  const active = trackers.filter((t) => t.status === 'active');
  const owe = active.filter((t) => t.direction === 'owe');
  const owedToMe = active.filter((t) => t.direction === 'owed_to_me');
  const owePayments = payments.filter((p) => p.direction === 'owe');

  // Unpaid comes from active trackers. Paid is history: a one-time debt paid this month is now
  // Done, and still belongs in "₱X paid of ₱Y" for this month.
  const unpaidOf = (list: Tracker[]) =>
    list.map((t) => ({ t, amount: unpaidOccurrencesIn(t, start, end) * t.amountCentavos }));
  const oweUnpaid = unpaidOf(owe);
  const owePaidThisMonth = owePayments.filter((p) => inMonth(p.occurrenceDueDate));

  const byType = new Map<DebtType, number>();
  const addType = (type: DebtType, amount: number) => byType.set(type, (byType.get(type) ?? 0) + amount);
  oweUnpaid.forEach(({ t, amount }) => addType(t.debtType, amount));
  owePaidThisMonth.forEach((p) => addType(p.debtType, p.amountCentavos));

  const balances = (list: Tracker[]) => list.flatMap((t) => (t.remainingCentavos == null ? [] : [t.remainingCentavos]));
  const oweBalances = balances(owe);
  const owedBalances = balances(owedToMe);

  const byDue = (a: Tracker, b: Tracker) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name);
  const dated = owePayments.filter((p) => p.occurrenceDueDate !== null);

  return {
    today,
    month: monthKey(today),
    dueThisMonth: {
      paid: sum(owePaidThisMonth.map((p) => p.amountCentavos)),
      unpaid: sum(oweUnpaid.map((u) => u.amount)),
    },
    nextDue: active.filter((t) => t.dueDate >= today).sort(byDue)[0] ?? null,
    overdue: active.filter((t) => t.dueDate < today).sort(byDue),
    totalDebt: oweBalances.length ? sum(oweBalances) : null,
    owedToYou: {
      unpaid: sum(unpaidOf(owedToMe).map((u) => u.amount)),
      remaining: owedBalances.length ? sum(owedBalances) : null,
    },
    paymentsByMonth: [-5, -4, -3, -2, -1, 0].map((offset) => {
      const month = monthKey(today, offset);
      return { month, total: sum(owePayments.filter((p) => p.paidOn.startsWith(month)).map((p) => p.amountCentavos)) };
    }),
    dueByType: [...byType]
      .filter(([, total]) => total > 0)
      .map(([type, total]) => ({ type, total }))
      .sort((a, b) => b.total - a.total),
    onTime: {
      onTime: dated.filter((p) => p.paidOn <= p.occurrenceDueDate!).length,
      total: dated.length,
    },
    byUrgency: {
      low: active.filter((t) => t.urgency === 'low').length,
      normal: active.filter((t) => t.urgency === 'normal').length,
      high: active.filter((t) => t.urgency === 'high').length,
    },
  };
}
