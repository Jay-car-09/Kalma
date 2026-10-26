# Kalma — Reminders Engine (Spec Section 4)

> Source of truth for reminders. Read with CLAUDE.md and docs/data-model.md.

**Purpose:** shared notification infrastructure. Debt reminders are its first user; future modules reuse it unchanged. **[HOOK]**

## Architecture — two separate parts
1. **`planReminders(trackers, now, settings, isPaid)`** — a PURE function (no side effects) that returns a list of `{ trackerId, fireAt, kind }` where kind is `'before_due' | 'due_day' | 'overdue'`. Works on any tracker row from any module.
2. **`syncReminders()`** — the only code that talks to the phone: cancels all Kalma-scheduled notifications, runs `planReminders` on fresh database data, schedules the results with expo-notifications, and records them in the `scheduled_notifications` table (replacing old rows).

Call `syncReminders()` on: app start, app returning to foreground, any tracker or payment change, Mark Paid/Undo, reminder-time change, language change, isPaid change. Rebuilding everything each time keeps it simple and always correct.

## Who gets reminders
Trackers with `notify=1`, `status='active'`, `deleted_at IS NULL`. On Free, as a safety net, plan for at most 5 trackers (earliest `due_date` first) even if more have `notify=1`.

## When
Urgency mapping from CLAUDE.md section 4, at the user's reminder time (default 9:00 AM local):
- **Low:** due day; one overdue nudge the day after.
- **Normal:** 3 days before, due day; overdue nudges 1 and 3 days after.
- **High:** 7, 3, 1 days before, due day; daily overdue nudges for up to 7 days after.

Rules:
- Plan for the current `due_date` AND future occurrences of recurring trackers within the next 60 days, so reminders still arrive if the app isn't opened.
- Overdue nudges apply only to the current unpaid `due_date`.
- Skip any time already in the past.
- Skip any "before" reminder that falls on or before the previous occurrence's due date (short intervals).
- Platform cap: iOS keeps at most 64 pending notifications per app. Sort all planned reminders by `fireAt` and keep only the nearest 60.

## Message
In the app's current language, calm tone, no alarm words.
- **Title:** the tracker name.
- **Body,** e.g. "Due in 3 days", "Due today", "Was due yesterday". Owed-to-me: "Expected in 3 days", "Expected today", "Was expected yesterday".
- Amounts hidden by default. Settings toggle **"Show amounts in notifications"** (default off) adds the peso amount when on.
- Module-specific wording comes from a small message registry keyed by module, so future modules add their own wording. **[HOOK]**
- Tapping a notification opens that tracker's detail screen.
- Android: one notification channel named "Due reminders", default importance (not max).

## Permission
- Ask the first time the user saves a tracker with Notify on, with a one-line explanation first.
- If denied: trackers keep `notify=1`, a calm notice appears in Settings with a button to open the phone's notification settings, and notified tracker rows show a small "Notifications off" note.

## Settings
Reminder time picker, "Show amounts in notifications" toggle.
Dev-only (development builds only): "Send a test reminder in 10 seconds" button, and a "Scheduled reminders" list showing every planned reminder (tracker, date/time, kind) so the owner can verify the engine.

## Tests for `planReminders`
Each urgency's offsets; notify off, done, archived and deleted excluded; Free cap of 5 (earliest due first) vs Paid unlimited; past times skipped; the short-interval skip rule (daily and weekly High trackers); overdue nudges only for the current `due_date`; recurring occurrences within 60 days; the 60 nearest cap; owed-to-me wording.
