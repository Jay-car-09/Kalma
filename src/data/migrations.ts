import type { SQLiteDatabase } from 'expo-sqlite';

// Numbered migrations, applied in order (data-model §1.6).
// NEVER edit a migration once it has shipped — add a new one at the end.
const migrations: string[] = [
  // 1 — initial schema (data-model §2)
  `
  CREATE TABLE trackers (
    id TEXT PRIMARY KEY NOT NULL,
    module TEXT NOT NULL DEFAULT 'debt',
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    amount_centavos INTEGER CHECK (amount_centavos IS NULL OR amount_centavos >= 0),
    currency TEXT NOT NULL DEFAULT 'PHP',
    due_date TEXT NOT NULL,
    recurrence TEXT NOT NULL,
    urgency TEXT NOT NULL CHECK (urgency IN ('low', 'normal', 'high')),
    notify INTEGER NOT NULL CHECK (notify IN (0, 1)),
    status TEXT NOT NULL CHECK (status IN ('active', 'done', 'archived')),
    notes TEXT,
    user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE debt_details (
    tracker_id TEXT PRIMARY KEY NOT NULL REFERENCES trackers (id),
    direction TEXT NOT NULL CHECK (direction IN ('owe', 'owed_to_me')),
    debt_type TEXT NOT NULL CHECK (debt_type IN ('credit_card', 'personal_loan', 'bnpl',
      'online_lending', 'sss_loan', 'pagibig_loan', 'informal', 'other')),
    starting_balance_centavos INTEGER,
    interest_rate REAL,
    interest_period TEXT CHECK (interest_period IS NULL OR interest_period IN ('monthly', 'annual')),
    statement_cutoff_day INTEGER CHECK (statement_cutoff_day IS NULL OR statement_cutoff_day BETWEEN 1 AND 31),
    user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE payments (
    id TEXT PRIMARY KEY NOT NULL,
    tracker_id TEXT NOT NULL REFERENCES trackers (id),
    kind TEXT NOT NULL CHECK (kind IN ('payment', 'adjustment')),
    amount_centavos INTEGER NOT NULL,
    paid_on TEXT NOT NULL,
    occurrence_due_date TEXT,
    note TEXT,
    user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE scheduled_notifications (
    os_notification_id TEXT PRIMARY KEY NOT NULL,
    tracker_id TEXT NOT NULL,
    fire_at TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('before_due', 'due_day', 'overdue'))
  );

  CREATE INDEX idx_trackers_due ON trackers (deleted_at, due_date);
  CREATE INDEX idx_payments_tracker ON payments (tracker_id);
  CREATE INDEX idx_scheduled_notifications_tracker ON scheduled_notifications (tracker_id);
  `,
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  for (let version = row?.user_version ?? 0; version < migrations.length; version++) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(migrations[version]);
      await tx.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
