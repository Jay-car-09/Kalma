-- Kalma cloud schema (docs/accounts-security.md §3).
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this whole file → Run.
-- It runs as one transaction: if any part fails, nothing is created and you can run it again.
-- Never edit this file after it has been run on a real project; add 0002_… instead.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tables
-- The same columns as the phone's tables (docs/data-model.md §2), so sync is a straight copy:
--   • money in whole centavos. bigint, because integer would stop at ₱21 million.
--   • calendar dates as 'YYYY-MM-DD' text; timestamps as ISO-8601 UTC text, exactly as the phone writes them.
--   • notify stays 0/1, and recurrence stays JSON text.
--   • ids are the phone-made UUIDs (Postgres has a real uuid type, so bad ids are refused).
-- Cloud-only additions:
--   • user_id is required and points at the account. Deleting the account deletes its rows (ON DELETE CASCADE).
--   • server_updated_at: the server's own time of the last change (see 2).
-- scheduled_notifications is never in the cloud: each phone schedules its own reminders.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.trackers (
  id uuid primary key,
  module text not null default 'debt',
  name text not null check (length(trim(name)) > 0),
  amount_centavos bigint check (amount_centavos is null or amount_centavos >= 0),
  currency text not null default 'PHP',
  due_date text not null,
  recurrence text not null,
  urgency text not null check (urgency in ('low', 'normal', 'high')),
  notify integer not null check (notify in (0, 1)),
  status text not null check (status in ('active', 'done', 'archived')),
  notes text,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at text not null,
  -- Must look like 2026-10-27T04:17:00.000Z, so "older" and "newer" compare correctly (see 3).
  updated_at text not null check (updated_at ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'),
  deleted_at text,
  server_updated_at timestamptz not null default now(),
  -- Lets debt_details and payments prove they belong to the same account as their tracker.
  unique (id, user_id)
);

create table public.debt_details (
  tracker_id uuid primary key,
  direction text not null check (direction in ('owe', 'owed_to_me')),
  debt_type text not null check (debt_type in ('credit_card', 'personal_loan', 'bnpl',
    'online_lending', 'sss_loan', 'pagibig_loan', 'informal', 'other')),
  starting_balance_centavos bigint,
  interest_rate double precision, -- SQLite REAL is the same 8-byte number
  interest_period text check (interest_period is null or interest_period in ('monthly', 'annual')),
  statement_cutoff_day integer check (statement_cutoff_day is null or statement_cutoff_day between 1 and 31),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null check (updated_at ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'),
  deleted_at text,
  server_updated_at timestamptz not null default now(),
  -- Details can only attach to a tracker of the same account.
  foreign key (tracker_id, user_id) references public.trackers (id, user_id) on delete cascade
);

create table public.payments (
  id uuid primary key,
  tracker_id uuid not null,
  kind text not null check (kind in ('payment', 'adjustment')),
  amount_centavos bigint not null,
  paid_on text not null,
  occurrence_due_date text,
  note text,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null check (updated_at ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'),
  deleted_at text,
  server_updated_at timestamptz not null default now(),
  -- Payments can only attach to a tracker of the same account.
  foreign key (tracker_id, user_id) references public.trackers (id, user_id) on delete cascade
);

-- Sync asks "what changed for this account since …?", so look rows up by account + server time.
create index trackers_sync on public.trackers (user_id, server_updated_at);
create index debt_details_sync on public.debt_details (user_id, server_updated_at);
create index payments_sync on public.payments (user_id, server_updated_at);
create index payments_tracker on public.payments (tracker_id, user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. server_updated_at: the server's clock stamps every insert and update.
-- Phones' clocks can be wrong, so sync's "changed since" cursor uses this column, never updated_at.
-- shortcut: now() is when the saving transaction started, so two phones saving at the same moment
-- can commit out of order; the sync pull (Phase 2C) must re-read a few seconds back to never miss a row.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.set_server_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at := now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Latest change wins: an update that carries an OLDER updated_at than the saved row is
-- rejected, and the saved (newer) row stays as it is.
-- It skips just that row instead of raising an error, so the rest of a sync batch still saves.
-- The phone sees the row wasn't written and pulls the newer version.
-- 'collate "C"' compares the text character by character, which is correct for this timestamp format.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.reject_older_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at collate "C" < old.updated_at collate "C" then
    return null; -- skip this row's update
  end if;
  return new;
end;
$$;

-- Triggers of the same kind run in name order: reject_older_update, then set_server_updated_at.
create trigger reject_older_update before update on public.trackers
  for each row execute function public.reject_older_update();
create trigger set_server_updated_at before insert or update on public.trackers
  for each row execute function public.set_server_updated_at();

create trigger reject_older_update before update on public.debt_details
  for each row execute function public.reject_older_update();
create trigger set_server_updated_at before insert or update on public.debt_details
  for each row execute function public.set_server_updated_at();

create trigger reject_older_update before update on public.payments
  for each row execute function public.reject_older_update();
create trigger set_server_updated_at before insert or update on public.payments
  for each row execute function public.set_server_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Row Level Security: every account sees and changes ONLY its own rows.
-- The database itself enforces this, so even a buggy app can't reach another account's data.
-- That is what makes the publishable (anon) key safe to ship inside the app.
-- Each table gets one policy per action: read (select), add (insert), change (update), remove (delete).
-- "(select auth.uid())" is the signed-in account's id. Wrapping it in select is Supabase's
-- recommended form: same meaning as user_id = auth.uid(), but checked once per query, not per row.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.trackers enable row level security;
alter table public.debt_details enable row level security;
alter table public.payments enable row level security;

create policy "Read own trackers" on public.trackers
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Add own trackers" on public.trackers
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Change own trackers" on public.trackers
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Remove own trackers" on public.trackers
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Read own debt details" on public.debt_details
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Add own debt details" on public.debt_details
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Change own debt details" on public.debt_details
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Remove own debt details" on public.debt_details
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Read own payments" on public.payments
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Add own payments" on public.payments
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Change own payments" on public.payments
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Remove own payments" on public.payments
  for delete to authenticated using (user_id = (select auth.uid()));

-- Table permissions, on top of RLS: signed-in accounts may use the tables (RLS still limits them
-- to their own rows); signed-out visitors ("anon") get nothing at all.
grant select, insert, update, delete on public.trackers, public.debt_details, public.payments to authenticated;
revoke all on public.trackers, public.debt_details, public.payments from anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. delete_my_account(): the in-app "Delete account" button calls this (accounts-security §3.3, §6).
-- It deletes ONLY the account that calls it (auth.uid()); ON DELETE CASCADE then removes all of
-- that account's trackers, details and payments.
-- SECURITY DEFINER: it runs with the database owner's rights, because the app itself may not touch
-- auth.users. That is why it takes no input, and why search_path is fixed to '' (so nobody can trick it
-- with look-alike tables; every name below is written out in full).
-- ─────────────────────────────────────────────────────────────────────────────

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = me;
end;
$$;

-- Only signed-in accounts can call it.
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

commit;
