import { describe, expect, it } from '@jest/globals';

import { shouldLock } from '../lock';

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
