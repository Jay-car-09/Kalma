// App lock timing (docs: Phase 1F). Pure, so it's unit-tested.

export type LockAfter = 'immediately' | '1m' | '5m';

export const LOCK_AFTER_MS: Record<LockAfter, number> = {
  immediately: 0,
  '1m': 60_000,
  '5m': 300_000,
};

/** Should returning to the app ask to unlock? `backgroundedAt` is null if it never left. */
export function shouldLock(lockAfter: LockAfter, backgroundedAt: number | null, now: number): boolean {
  return backgroundedAt !== null && now - backgroundedAt >= LOCK_AFTER_MS[lockAfter];
}
