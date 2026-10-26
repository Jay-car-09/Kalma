// Test stand-in for ../db: runs the real migrations and repository SQL against Node's
// built-in SQLite (expo-sqlite only exists on a phone). Use with jest.mock('../db').
const { DatabaseSync } = require('node:sqlite');

const args = (params: unknown[]) => (Array.isArray(params[0]) ? params[0] : params);
let sqlite = new DatabaseSync(':memory:');

export const db = {
  /** Fresh empty database; call in beforeEach. */
  reset: () => (sqlite = new DatabaseSync(':memory:')),
  execAsync: async (sql: string) => sqlite.exec(sql),
  runAsync: async (sql: string, ...p: unknown[]) => sqlite.prepare(sql).run(...args(p)),
  getFirstAsync: async (sql: string, ...p: unknown[]) => sqlite.prepare(sql).get(...args(p)) ?? null,
  getAllAsync: async (sql: string, ...p: unknown[]) => sqlite.prepare(sql).all(...args(p)),
  withExclusiveTransactionAsync: async (task: (tx: unknown) => Promise<void>) => {
    sqlite.exec('BEGIN');
    try {
      await task(db);
      sqlite.exec('COMMIT');
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw e;
    }
  },
};
