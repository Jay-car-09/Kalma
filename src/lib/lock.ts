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

export type LockState = {
  locked: boolean;
  /** Privacy cover: the app isn't in front. */
  covered: boolean;
  backgroundedAt: number | null;
};

type AppStateChange = {
  appState: string;
  lockAfter: LockAfter;
  now: number;
  /** The unlock prompt itself can briefly background the app; that isn't "leaving". */
  authenticating: boolean;
};

/** What one app-state change does to the lock (the app lock is on). */
export function nextLockState(s: LockState, { appState, lockAfter, now, authenticating }: AppStateChange): LockState {
  if (authenticating) return s;
  if (appState === 'active') {
    return { locked: s.locked || shouldLock(lockAfter, s.backgroundedAt, now), covered: false, backgroundedAt: null };
  }
  // 'inactive' (Control Center, app switcher) covers the app; only 'background' starts the timer.
  const backgroundedAt = appState === 'background' ? (s.backgroundedAt ?? now) : s.backgroundedAt;
  return { ...s, covered: true, backgroundedAt };
}
