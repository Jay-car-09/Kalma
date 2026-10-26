# Kalma — Data Model (Spec Section 2)

> Source of truth for how Kalma stores data. Read with CLAUDE.md.
> Status: v1 (launch). Future-module hooks are marked **[HOOK]** — build them now, use them later.

---

## 1. Ground rules (apply to every table)

1. **Local-first.** All data lives in an on-device SQLite database (`expo-sqlite`) for **both** guests and account users. Account users additionally sync to the cloud (Phase 2). The app always reads from the local database, so it works offline.
2. **IDs are UUIDs generated on the device** (`expo-crypto` → `randomUUID()`). Never auto-increment integers — they collide when two devices sync.
3. **Money is stored as whole centavos (INTEGER).** ₱2,450.50 → `245050`. Never store money as decimals/floats. Convert only when displaying (via the shared `<Amount>` component).
4. **Calendar dates** (due dates, paid-on dates) are stored as `'YYYY-MM-DD'` text in the user's local calendar — no time, no timezone.
   **Timestamps** (created/updated/deleted) are ISO-8601 UTC text, e.g. `2026-10-27T04:17:00.000Z`.
5. **Every synced table has these 4 columns** [HOOK — the account/sync system relies on this]:
   | Column | Type | Rule |
   |---|---|---|
   | `user_id` | TEXT, nullable | `NULL` for guests. Filled in when a guest upgrades / when an account user creates data. |
   | `created_at` | TEXT | Set once. |
   | `updated_at` | TEXT | Set on **every** change. Sync uses this (latest change wins). |
   | `deleted_at` | TEXT, nullable | **Soft delete.** Deleting sets this; rows are never physically removed while unsynced. Every query must filter `deleted_at IS NULL`. |
6. **Schema versioning:** use SQLite `PRAGMA user_version`. A small migration runner applies numbered migrations in order on app start. Never edit a released migration — add a new one.
7. All database access goes through **one data layer** (repository functions). Screens never write SQL directly.

---

## 2. Tables

### 2.1 `trackers` — the shared core [HOOK]
Every trackable item in Kalma, from **any** module, is one row here. The reminders engine, tier limits and dashboard read **only this table** (plus module detail tables when they need specifics). Future modules add rows with a different `module` value — no restructuring.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `module` | TEXT | `'debt'` in v1. **[HOOK]** future: `'subscription'`, `'insurance'`, `'points'`, `'document'`, `'ipon'` |
| `name` | TEXT, required | Lender, borrower, or item name |
| `amount_centavos` | INTEGER, nullable | Amount due **each occurrence** (recurring) or the full amount (one-time). Nullable because some future modules have no amount (e.g. document expiry). Required for `module='debt'`. |
| `currency` | TEXT | Always `'PHP'` in v1. **[HOOK]** multi-currency later. |
| `due_date` | TEXT `YYYY-MM-DD` | The **current unpaid occurrence**. Advances when that occurrence is marked paid. |
| `recurrence` | TEXT (JSON) | See §3 |
| `urgency` | TEXT | `'low'` · `'normal'` · `'high'` |
| `notify` | INTEGER 0/1 | Reminders on/off |
| `status` | TEXT | `'active'` · `'done'` · `'archived'` |
| `notes` | TEXT, nullable | |
| + `user_id`, `created_at`, `updated_at`, `deleted_at` | | Ground rule 5 |

### 2.2 `debt_details` — debt-only fields (1:1 with `trackers` where `module='debt'`)
**[HOOK]** Each future module gets its own `<module>_details` table the same way. The core never changes.

| Column | Type | Notes |
|---|---|---|
| `tracker_id` | TEXT PK, FK → `trackers.id` | |
| `direction` | TEXT | `'owe'` (I owe) · `'owed_to_me'` |
| `debt_type` | TEXT | `'credit_card'` · `'personal_loan'` · `'bnpl'` · `'online_lending'` · `'sss_loan'` · `'pagibig_loan'` · `'informal'` · `'other'` |
| `starting_balance_centavos` | INTEGER, nullable | "Remaining balance" as entered in More details. `NULL` = user isn't tracking a balance. |
| `interest_rate` | REAL, nullable | Percent, e.g. `3.5`. **Display only — never calculated in v1.** **[HOOK]** payoff planner input. |
| `interest_period` | TEXT, nullable | `'monthly'` · `'annual'` (many PH loans quote monthly rates). **[HOOK]** payoff planner. |
| `statement_cutoff_day` | INTEGER, nullable | 1–31, credit cards only. **[HOOK]** cutoff optimizer. |
| + `user_id`, `created_at`, `updated_at`, `deleted_at` | | Ground rule 5 |

### 2.3 `payments` — history entries (many per tracker)
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `tracker_id` | TEXT, FK → `trackers.id` | |
| `kind` | TEXT | `'payment'` (Paid / Received) · `'adjustment'` (balance correction, e.g. new credit card purchases) |
| `amount_centavos` | INTEGER | Payments: positive. Adjustments: positive = balance went **up**, negative = went down. |
| `paid_on` | TEXT `YYYY-MM-DD` | Date the user paid. Defaults to today. |
| `occurrence_due_date` | TEXT `YYYY-MM-DD`, nullable | Which occurrence this payment settles. `NULL` for adjustments. Drives "paid this cycle" and the on-time record (`paid_on <= occurrence_due_date`). |
| `note` | TEXT, nullable | |
| + `user_id`, `created_at`, `updated_at`, `deleted_at` | | Ground rule 5 |

### 2.4 `scheduled_notifications` — reminders engine bookkeeping [HOOK]
**Device-local only. Never synced** (each phone schedules its own). Lets the engine cancel and rebuild reminders cleanly. Full behavior is specified in Section 4 (reminders engine).

| Column | Type | Notes |
|---|---|---|
| `os_notification_id` | TEXT PK | ID returned by the phone's notification system |
| `tracker_id` | TEXT | Works for any module's tracker |
| `fire_at` | TEXT | ISO timestamp |
| `kind` | TEXT | `'before_due'` · `'due_day'` · `'overdue'` |

### 2.5 Not tables (deliberately)
- **Remaining balance** — never stored as a running number. Always computed (§4), so editing or deleting a payment fixes the balance automatically.
- **People / borrower names** — autocomplete reads distinct `trackers.name`. **[HOOK]** a `people` table arrives with the ipon accountability-buddy module.
- **Analytics** — computed from `trackers` + `payments` on the fly.
- **Settings** (theme, language, reminder time, app lock, `isPaid`) — stay in AsyncStorage, device-local.

---

## 3. `recurrence` JSON

| Option in the Add sheet | Stored value |
|---|---|
| One-time | `{"type":"none"}` |
| Weekly | `{"type":"weekly"}` (same weekday as `due_date`) |
| Twice a month | `{"type":"twice_monthly","days":[15,30]}` |
| Monthly | `{"type":"monthly","day":31}` (the anchor day the user chose) |
| Custom | `{"type":"custom","every":3,"unit":"day"}` — `unit`: `'day'` · `'week'` · `'month'` |

**Rules for the next occurrence** (one pure function, `nextOccurrence(recurrence, fromDate)`, with unit tests):
- Monthly / twice-a-month days that don't exist in a month **clamp to the last day** (anchor 31 → Feb 28/29, Apr 30). The anchor is kept, so March returns to the 31st.
- Custom months follow the same clamping. Custom days/weeks just add.
- One-time has no next occurrence.

---

## 4. Derived values (computed, never stored)

| Value | Definition |
|---|---|
| **Remaining balance** | `starting_balance − Σ payments + Σ adjustments` (non-deleted entries of that tracker). Only exists when `starting_balance_centavos` is set. |
| **Overdue** | `status='active'` and `due_date < today` |
| **Due soon** | `status='active'` and `due_date` within the next 3 days (incl. today) |
| **Paid this occurrence** | a non-deleted payment exists with `occurrence_due_date = due_date` |
| **Total debt** (dashboard) | Σ remaining balance of active `owe` trackers that track a balance |
| **Due this month** (dashboard) | For active `owe` trackers: every occurrence falling in the current calendar month × `amount`, split into paid vs unpaid |
| **Owed to me** (dashboard) | Same calculations for `owed_to_me` trackers — always shown separately, never netted |

---

## 5. Lifecycle rules

1. **Mark Paid / Received** → insert a `payment` (amount defaults to `amount_centavos`, editable; `occurrence_due_date = due_date`). Then:
   - Recurring → advance `due_date` to the next occurrence.
   - One-time → `status='done'`, `notify=0`.
   - Balance tracked and remaining balance ≤ 0 → `status='done'`, `notify=0`.
2. **Missed several occurrences:** `due_date` stays on the **oldest unpaid** occurrence. Each Mark Paid settles one occurrence, oldest first.
3. **Delete a payment** → soft-delete it. If it was the latest payment for the current cycle, move `due_date` back to its `occurrence_due_date` and restore `status='active'` if it had become done.
4. **Archive** → `status='archived'`, `notify=0`. Still counts toward the Free limit.
5. **Delete tracker** → soft-delete the tracker, its `debt_details` and its `payments` together. Warn first: "This also deletes its payment history."
6. **Every write** updates `updated_at`. Multi-table changes happen in **one transaction**.

---

## 6. Tier limits in data

| Rule | Query | Free limit |
|---|---|---|
| Trackers stored | count `trackers` where `deleted_at IS NULL` (**any** status) | 10 |
| Notified trackers | count `trackers` where `deleted_at IS NULL AND status='active' AND notify=1` | 5 |

- Limits come from **one function**, e.g. `getLimits(isPaid)`, so Phase 3 swaps the flag for the real subscription without touching screens.
- Enforce in the **data layer** (not just the UI): creating a tracker or turning `notify` on must check the limit and refuse with a typed error the screen turns into a calm prompt.
- **[HOOK]** Future modules' trackers count toward the same limits (one tracker = one tracker, whatever the module).

---

## 7. Future-module hook summary

| Future module | Plugs in via |
|---|---|
| Payoff planner | reads `debt_details` (balance, interest, period) + `payments` — no schema change |
| Subscription tracker | `module='subscription'` + `subscription_details` |
| Credit card cutoff optimizer | reads `debt_details.statement_cutoff_day` |
| Insurance / HMO tracker | `module='insurance'` + `insurance_details` |
| Points / rewards expiry | `module='points'` + `points_details` (amount nullable) |
| Ipon challenge + buddy | `module='ipon'` + `ipon_details`; adds `people` table |
| Document expiry | `module='document'` + `document_details` (no amount) |

All of them get reminders, tier limits, sync and dashboard cards for free by living in `trackers`.
