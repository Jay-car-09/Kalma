# Kalma — Accounts, Cloud Storage & Security (Spec Section 3)

> Source of truth for guest vs account, sync, the guest → account upgrade, and security.
> Read with CLAUDE.md and docs/data-model.md. Security here is **mandatory from day one** — nothing in this file is optional or "later".

---

## 1. Decisions and why

### 1.1 Where account data lives → **Supabase** (Postgres + Auth), region **Singapore**
Reasoning:
1. Kalma's local database is relational (SQLite). Supabase is Postgres — the same shape, so sync is a straight table-to-table copy. A document database (Firebase Firestore) would need a translation layer.
2. **Row Level Security (RLS)** enforces "each user sees only their own rows" inside the database itself — even a buggy app can't leak another user's data.
3. Encryption is built in: all customer data is encrypted at rest with AES-256 and in transit via TLS. Paid plans add daily backups.
4. Auth is included (email one-time codes, later Apple/Google), works in Expo Go via the JavaScript client, and is heavily represented in AI training data.
5. Singapore is the closest region to the Philippines (faster sync).
6. Rejected: self-hosting on the owner's 1 GB server (owner would carry patching, backups, intrusion risk); Google Apps Script (not built for secure multi-device data).

### 1.2 Login → **passwordless email one-time code (6 digits)**
Reasoning: no passwords to forget, reuse or leak; no "forgot password" flow; familiar to Filipino users from bank and e-wallet apps.
- **v1 ships with email code only.** App Store rules require offering an equivalent privacy-focused option only when an app uses third-party social login — email-only avoids that. Sign in with Apple / Google can be added after launch (needs development builds anyway).
- **Custom SMTP is required before real users.** Supabase's built-in email only sends to the project's own team members and is capped at 2 messages per hour. Use an SMTP provider (e.g. Resend or Brevo) sending from the owner's domain, e.g. `no-reply@<owner-domain>`.

### 1.3 Encryption
| Where | How | Status |
|---|---|---|
| Cloud, at rest | Supabase AES-256 disk encryption | Built in |
| Cloud ↔ phone | TLS (HTTPS) only — never plain HTTP | Built in; app must use the `https://` project URL |
| Login session on phone | Stored encrypted: encryption key in the phone's secure keychain (`expo-secure-store`), using Supabase's documented secure-storage pattern for Expo. Never plain AsyncStorage. | Build in Phase 2 |
| Local database on phone | Protected by the phone's own full-device encryption (iOS Data Protection, Android file-based encryption) + Kalma's optional app lock | v1 |

**Considered and not in v1:** end-to-end encryption (Kalma itself unable to read data). Strongest privacy, but a lost key means permanently lost data, and it blocks future server-side features. Revisit after launch. Encrypting the local SQLite file (SQLCipher) needs development builds — revisit in Phase 3.

---

## 2. User types

| | Guest | Account |
|---|---|---|
| Login | None | Email + 6-digit code |
| Data location | This phone only (SQLite) | This phone (SQLite) **and** Supabase cloud |
| `user_id` on rows | `NULL` | The account's ID |
| Works offline | Yes | Yes — changes sync when back online |
| Multiple devices | No | Yes |
| If phone is lost/reset | Data is gone | Data restored by signing in |

- First launch = guest, instantly. No sign-up wall.
- Account tab (guest state): one calm card — "Back up and sync across your phones" → **Create account / Sign in** (same flow; the code email works for both).
- Tier (Free/Paid) is separate from account type. A guest can be Free or Paid.

---

## 3. Cloud database

### 3.1 Tables
Mirror the synced local tables exactly: `trackers`, `debt_details`, `payments` (same columns, same types; money stays integer centavos; dates stay text).
Additions on the cloud side only:
- `user_id` is **required** (`NOT NULL`), references `auth.users(id)` **ON DELETE CASCADE**.
- `server_updated_at timestamptz` — set by a database trigger to `now()` on every insert/update. This is the sync cursor (phones' clocks can be wrong; the server's clock is the reference).
- A trigger that **rejects an update whose `updated_at` is older** than the stored row's `updated_at` (keeps the newest change — "latest change wins").
- `scheduled_notifications` is **never** in the cloud.

### 3.2 Row Level Security (mandatory)
- RLS **enabled on every table**, no exceptions. A table without RLS must never exist in the cloud.
- Policies on each table, for each of select / insert / update / delete: `user_id = auth.uid()`.
- The app uses only the **publishable (anon) key** — safe *because* RLS is on.
- The **service_role (secret) key is never** in the app, the repo, or chat. It stays in the Supabase dashboard.
- **Required test:** with two test accounts, prove account B cannot read, change or delete account A's rows.

### 3.3 Account deletion function
`delete_my_account()` — a Postgres function (`SECURITY DEFINER`, fixed `search_path`) that deletes **only** the calling user (`auth.uid()`) from `auth.users`. The `ON DELETE CASCADE` removes all their rows. The app calls it via RPC.

---

## 4. Sync (account users only)

**Model:** local-first, push then pull, latest change wins per row.

Local additions (new migration; device-local, never sent to the cloud):
- On every synced table: `needs_push INTEGER DEFAULT 1` — set to 1 on every local write.
- Table `sync_state`: `last_pulled_at` (the server timestamp of the newest row received).

**One sync run (`syncNow()`):**
1. **Push:** send all rows with `needs_push = 1` (in batches) as upserts. On success, set `needs_push = 0`. Rows the server rejected as older are simply re-pulled in step 2.
2. **Pull:** fetch rows where `server_updated_at > last_pulled_at`, write them locally (`needs_push = 0`), including soft-deleted rows so deletions spread to every device. Update `last_pulled_at`.
3. Run `syncReminders()` so reminders match the merged data.

**When:** app start, app returning to foreground, ~2 seconds after any local change (debounced), and right after sign-in. If offline or a request fails: keep `needs_push`, retry later with increasing waits. Sync failures never block the app or lose local data; show a quiet "Last synced …" line in the Account tab and a calm "Not synced yet" note when behind.

**Realtime/live updates:** not in v1.

---

## 5. Guest → account upgrade

1. Guest taps **Create account / Sign in** → enters email → enters the 6-digit code.
2. **If the account is new (no cloud rows):** in one transaction, set `user_id` on all local rows and `needs_push = 1`, then sync. All guest data is now backed up.
3. **If the account already has cloud data** (made on another phone) **and this phone has guest data:** ask once —
   - **"Combine"** (default, recommended): add this phone's trackers to the account. IDs are UUIDs, so nothing collides.
   - **"Use account data only"**: confirm, then remove this phone's guest data and pull the account.
4. **If this phone has no guest data:** just pull the account.

**Limits never delete data.** If combining puts a Free user over 10 trackers or 5 notified, keep everything; block *adding* new trackers until they're under 10; the reminders engine still notifies only the earliest 5.

---

## 6. Sign out, delete, switching accounts

- **Sign out:** first run a sync. If unsynced changes remain (offline), warn: "Some changes aren't backed up yet." On confirm: clear the session, **remove the account's data from this phone** (privacy on shared phones), cancel its reminders. The app returns to a fresh guest state.
- **Switching accounts:** sign out, then sign in with the other account.
- **Delete account** (required by both app stores): Account tab → Delete account → plain explanation → type "DELETE" to confirm → call `delete_my_account()` → wipe local data → fresh guest. Must work in-app.
- **Web deletion link** (Google Play requires one): a simple page on the owner's domain explaining in-app deletion and offering an email request route. Owner handles the page text.

---

## 7. Responsible data handling (rules for all code)

1. **Collect only what's needed:** email + the tracker data the user types. No contacts, location, SMS, call logs, photos, or advertising IDs for Kalma's own use.
2. **Tracker data never leaves Kalma's own systems.** It is never sent to the ad SDK, analytics, or any third party.
3. **No sensitive data in logs.** Never log tracker names, amounts, notes, borrower names or emails — in console output, crash reports or error messages. Log IDs and error types only.
4. **Borrower names are other people's personal information.** Treat them like the user's own data.
5. **Least privilege:** only the publishable key in the app; secret keys never leave the dashboard.
6. **Owner accounts use two-factor authentication:** Supabase, GitHub, Apple, Google, the SMTP provider, the domain registrar.
7. **Owner does not browse user data** in the Supabase dashboard except to investigate a reported problem.
8. **User rights are built into the app:** see (dashboard), correct (edit), export (CSV), delete (account deletion). The owner's legal documents cover the Philippine Data Privacy Act obligations.
9. **Secrets in files:** the Supabase URL and publishable key go in `.env` as `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`. `.env` is in `.gitignore`. A `.env.example` with blank values is committed.
10. **Backups:** upgrade to Supabase Pro before public launch for daily backups.

---

## 8. Auth hardening settings (Supabase dashboard)
- Email code expiry: 10 minutes. Code length: 6 digits.
- Keep Supabase's per-user email cooldown (default 60 seconds) and set sensible hourly limits after custom SMTP is on.
- Session: standard access token with automatic refresh; the app refreshes silently. Optional app lock remains separate.
- Email templates: plain, calm, Kalma-branded, English + Tagalog text in the same email.

---

## 9. Future-module hooks
- Any future `<module>_details` table follows the same cloud rules (RLS + `user_id` + `server_updated_at` + `needs_push` locally) and is added to the sync table list — sync, upgrade, sign-out and deletion then cover it automatically. [HOOK]
- The ipon accountability buddy (future) will need controlled sharing between two accounts — a separate, explicit sharing table with its own RLS. Not in v1. [HOOK]
