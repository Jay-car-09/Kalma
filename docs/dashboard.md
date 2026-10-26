# Kalma — Dashboard (Spec Section 5)

> Source of truth for the Home dashboard. Read with CLAUDE.md and docs/data-model.md.

**Purpose:** calm, at-a-glance answer to "what do I owe, what's due, what's next." It is also the bridge for future modules: build it as a list of independent card components registered in one array (a card registry), so future modules add cards without touching existing ones. **[HOOK]**

## Layout, top to bottom
Spacious, few elements, design system section 7.

1. **Header:** current month name (e.g. "October"). No greeting clutter.
2. **HERO — "Due this month":** the UNPAID amount as the hero number (40pt, tabular). Below it: "₱X paid of ₱Y" and a thin progress bar (paid portion green, rest light grey). If nothing is due this month: calm "Nothing due this month."
3. **NEXT DUE card:** tracker name, `<Amount>`, due date and "in N days" / "today". Tap opens the tracker.
4. **NEEDS ATTENTION card:** only shown if anything is overdue. Red-tinted card (overdueBg), up to 3 overdue trackers, then "See all" → Trackers list filtered to overdue. Calm wording, no alarm icons.
5. **TOTALS row,** two separate cards, never netted:
   - **"Total debt":** sum of remaining balances of active I-owe trackers that track a balance. If none track a balance, show a subtle hint: "Add a remaining balance to a tracker to see your total debt."
   - **"Owed to you":** unpaid amount due this month from Owed-to-me trackers, plus their total remaining balance if tracked.
6. **INSIGHTS section** (descriptive only, no projections, no advice):
   - a. **Payments made per month,** last 6 months (I-owe payments only, by `paid_on` month): simple vertical bars.
   - b. **By debt type:** horizontal bars of amount due this month per type.
   - c. **On-time record:** "8 of 10 payments on time" (`paid_on <= occurrence_due_date`), small bar: on-time green, late grey.
   - d. **By urgency:** count of active trackers per Low / Normal / High (greyscale).

   Charts are plain View-based bars: no chart library. Greyscale except the green on-time/paid portions.

## Definitions
Follow docs/data-model.md section 4.

- **"Due this month"** for I-owe trackers = occurrences with due dates in the current calendar month.
  - **Paid** = payments whose `occurrence_due_date` is in this month.
  - **Unpaid** = occurrences from the tracker's current `due_date` up to month end.
  - Weekly, twice-monthly and custom recurrences contribute every occurrence in the month.
  - Overdue occurrences from earlier months are NOT in this number; they appear in Needs Attention.
- **Archived and deleted trackers are excluded everywhere.** Done trackers count only in history-based figures (payments per month, on-time record).

## Behavior
- Recalculate whenever the Home tab comes into focus.
- Tapping a card opens the matching filtered Trackers list or tracker.
- Empty state (no trackers yet): calm welcome line + one "Add your first tracker" button.
- Same dashboard on Free and Paid. The ad banner placeholder stays above the tab bar on Free.
- All text in en.json and tl.json. Peso amounts always via `<Amount>`.

## Tests
Unit tests for all dashboard calculations, including a weekly tracker in a 5-week month, twice-monthly with one occurrence paid, an overdue occurrence from last month excluded from "due this month", total debt with and without balances, and the on-time count.
