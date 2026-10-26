import { openDatabaseSync } from 'expo-sqlite';

import { migrate } from './migrations';

// The one on-device database. Only files in src/data/ may import this.
export const db = openDatabaseSync('kalma.db');

export function prepareDatabase(): Promise<void> {
  return migrate(db);
}
