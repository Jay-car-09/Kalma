import { describe, expect, it } from '@jest/globals';

import { nextLockState, shouldLock, type LockAfter, type LockState } from '../lock';

const LEFT = 1_000_000; // when the app went to the background (ms)

describe('"Lock after" timing', () => {
  it('never locks if the app never went to the background', () => {
    expect(shouldLock('immediately', null, LEFT)).toBe(false);
  });

  it('Immediately: locks on any return', () => {
    expect(shouldLock('immediately', LEFT, LEFT)).toBe(true);
    expect(shouldLock('immediately', LEFT, LEFT + 1)).toBe(true);
  });

  it('After 1 minute: not before 60 s, yes at and after 60 s', () => {
    expect(shouldLock('1m', LEFT, LEFT + 59_999)).toBe(false);
    expect(shouldLock('1m', LEFT, LEFT + 60_000)).toBe(true);
    expect(shouldLock('1m', LEFT, LEFT + 3_600_000)).toBe(true);
  });

  it('After 5 minutes: not before 300 s, yes at 300 s', () => {
    expect(shouldLock('5m', LEFT, LEFT + 299_999)).toBe(false);
    expect(shouldLock('5m', LEFT, LEFT + 300_000)).toBe(true);
  });
});

describe('app-state changes', () => {
  const open: LockState = { locked: false, covered: false, backgroundedAt: null };
  const change = (s: LockState, appState: string, now = LEFT, lockAfter: LockAfter = 'immediately') =>
    nextLockState(s, { appState, lockAfter, now, authenticating: false });

  it('a brief "inactive" (Control Center) covers but never starts the lock timer', () => {
    const pulled = change(open, 'inactive');
    expect(pulled).toEqual({ locked: false, covered: true, backgroundedAt: null });
    expect(change(pulled, 'active', LEFT + 600_000)).toEqual(open);
  });

  it('leaving and coming back after the "Lock after" time locks', () => {
    const away = change(change(open, 'inactive'), 'background');
    expect(away).toEqual({ locked: false, covered: true, backgroundedAt: LEFT });
    expect(change(away, 'active', LEFT + 59_999, '1m')).toEqual(open);
    expect(change(away, 'active', LEFT + 60_000, '1m')).toEqual({ locked: true, covered: false, backgroundedAt: null });
  });

  it('the timer starts at the first "background", not a later one', () => {
    const away = change(change(open, 'background'), 'background', LEFT + 30_000);
    expect(away.backgroundedAt).toBe(LEFT);
  });

  it('ignores the unlock prompt\'s own app switches', () => {
    const locked = { ...open, locked: true };
    const during = nextLockState(locked, { appState: 'background', lockAfter: 'immediately', now: LEFT, authenticating: true });
    expect(during).toBe(locked);
  });

  it('stays locked when it was already locked', () => {
    expect(change({ ...open, locked: true }, 'active').locked).toBe(true);
  });
});
