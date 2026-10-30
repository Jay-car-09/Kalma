import { describe, expect, it, jest } from '@jest/globals';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

import { describeAuthError, isEmail, normalizeEmail, RESEND_SECONDS, resendSecondsLeft } from '../signIn';
import { judge, verdictOf } from '../selfTest';

// The phone-only storage modules aren't used here; stub them so the cloud modules load.
jest.mock('@react-native-async-storage/async-storage', () => ({}));
jest.mock('expo-secure-store', () => ({}));
jest.mock('expo-crypto', () => ({}));

describe('email normalisation', () => {
  it('trims spaces and lowercases', () => {
    expect(normalizeEmail('  Juan.Dela.Cruz@Gmail.COM \n')).toBe('juan.dela.cruz@gmail.com');
  });

  it('accepts a normal address and rejects obvious typos', () => {
    expect(isEmail('juan@gmail.com')).toBe(true);
    expect(isEmail('ana+kalma@mail.example.ph')).toBe(true);
    for (const bad of ['', 'juan', 'juan@', '@gmail.com', 'juan@gmail', 'juan @gmail.com', 'juan@@gmail.com']) {
      expect(isEmail(bad)).toBe(false);
    }
  });
});

describe('resend countdown', () => {
  const sentAt = 1_000_000;

  it('starts at 60 and counts down in whole seconds', () => {
    expect(RESEND_SECONDS).toBe(60);
    expect(resendSecondsLeft(sentAt, sentAt)).toBe(60);
    expect(resendSecondsLeft(sentAt, sentAt + 1)).toBe(60); // rounds up, never shows 0 too early
    expect(resendSecondsLeft(sentAt, sentAt + 30_000)).toBe(30);
    expect(resendSecondsLeft(sentAt, sentAt + 59_001)).toBe(1);
  });

  it('unlocks at 60 seconds and stays unlocked', () => {
    expect(resendSecondsLeft(sentAt, sentAt + 60_000)).toBe(0);
    expect(resendSecondsLeft(sentAt, sentAt + 3_600_000)).toBe(0);
  });

  it('never shows more than 60 if the clock goes backwards', () => {
    expect(resendSecondsLeft(sentAt, sentAt - 10_000)).toBe(60);
  });
});

describe('sign-in errors', () => {
  const otp = new AuthApiError('Token has expired or is invalid', 403, 'otp_expired');

  it('tells a wrong code from an expired one by its age', () => {
    expect(describeAuthError(otp, 30_000)).toBe('wrongCode');
    expect(describeAuthError(otp, 11 * 60_000)).toBe('expired');
  });

  it('maps rate limits, no internet and anything else', () => {
    expect(describeAuthError(new AuthApiError('x', 429, 'over_email_send_rate_limit'))).toBe('tooMany');
    expect(describeAuthError(new AuthApiError('x', 429, 'over_request_rate_limit'))).toBe('tooMany');
    expect(describeAuthError(new AuthRetryableFetchError('Network request failed', 0))).toBe('offline');
    // A server error (e.g. the code email failed to send) is not "no internet".
    expect(describeAuthError(new AuthRetryableFetchError('Error sending magic link email', 500))).toBe('serverError');
    expect(describeAuthError(new AuthApiError('x', 500, 'unexpected_failure'))).toBe('unknown');
    expect(describeAuthError(new Error('boom'))).toBe('unknown');
  });
});

describe('security self-test judging', () => {
  it('counts only an empty, error-free reply as blocked', () => {
    expect(judge({ data: [], error: null })).toBe('blocked');
    expect(judge({ data: null, error: null })).toBe('blocked');
    expect(judge({ data: [{ id: 'x' }], error: null })).toBe('allowed');
    // A refused or failed request proves nothing about account B, so it is never a pass.
    expect(judge({ data: null, error: { code: '42501' } })).toBe('error');
  });

  it('passes only when all three are blocked', () => {
    expect(verdictOf({ read: 'blocked', change: 'blocked', remove: 'blocked' })).toBe('pass');
    expect(verdictOf({ read: 'blocked', change: 'allowed', remove: 'error' })).toBe('fail');
    expect(verdictOf({ read: 'blocked', change: 'blocked', remove: 'error' })).toBe('incomplete');
  });
});
