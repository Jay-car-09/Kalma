import type { ComponentType } from 'react';

import type { Dashboard } from '@/lib/dashboard';

import { AttentionCard, HeroCard, NextDueCard, TotalsCard } from './cards';
import { ByTypeCard, ByUrgencyCard, OnTimeCard, PaymentsByMonthCard } from './insights';

export type DashboardCard = {
  id: string;
  section: 'main' | 'insights';
  Component: ComponentType<{ data: Dashboard }>;
  /** Skip the card when it has nothing to show. */
  hidden?: (data: Dashboard) => boolean;
};

// The Home dashboard, top to bottom (docs/dashboard.md). [HOOK] Future modules add their
// cards here — one entry each — without touching the existing ones.
export const dashboardCards: DashboardCard[] = [
  { id: 'due-this-month', section: 'main', Component: HeroCard },
  { id: 'next-due', section: 'main', Component: NextDueCard, hidden: (d) => !d.nextDue },
  { id: 'needs-attention', section: 'main', Component: AttentionCard, hidden: (d) => d.overdue.length === 0 },
  { id: 'totals', section: 'main', Component: TotalsCard },
  {
    id: 'payments-by-month',
    section: 'insights',
    Component: PaymentsByMonthCard,
    hidden: (d) => d.paymentsByMonth.every((m) => m.total === 0),
  },
  { id: 'by-type', section: 'insights', Component: ByTypeCard, hidden: (d) => d.dueByType.length === 0 },
  { id: 'on-time', section: 'insights', Component: OnTimeCard, hidden: (d) => d.onTime.total === 0 },
  {
    id: 'by-urgency',
    section: 'insights',
    Component: ByUrgencyCard,
    hidden: (d) => Object.values(d.byUrgency).every((n) => n === 0),
  },
];
