import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import type { TFunction } from 'i18next';

import { getSupabase } from './supabase';

/** Seconds before "Resend code" unlocks. Matches Supabase's per-email cooldown (accounts-security §8). */
export const RESEND_SECONDS = 60;
/** How long a code works. Set to 10 minutes in the Supabase dashboard (accounts-security §8). */
const CODE_LIFETIME_MS = 10 * 60 * 1000;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** A simple shape check (something@something.something). Supabase does the real check. */
export function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Whole seconds until a code sent at `sentAt` may be resent; 0 means it can be sent now. */
export function resendSecondsLeft(sentAt: number, now: number): number {
  const left = Math.ceil((sentAt + RESEND_SECONDS * 1000 - now) / 1000);
  return Math.min(RESEND_SECONDS, Math.max(0, left)); // a clock set backwards never shows more than 60
}

export type AuthProblem = 'wrongCode' | 'expired' | 'tooMany' | 'offline' | 'serverError' | 'unknown';

/** Turns a sign-in failure into one of the calm messages. Raw error text is never shown. */
export function describeAuthError(error: unknown, codeAgeMs = 0): AuthProblem {
  // Supabase reports "no answer" (status 0) and server errors (5xx, e.g. the code email failed to send) the same way.
  if (isAuthRetryableFetchError(error)) return error.status === 0 ? 'offline' : 'serverError';
  if (!isAuthError(error)) return 'unknown';
  if (error.status === 429 || error.code === 'over_request_rate_limit' || error.code === 'over_email_send_rate_limit') {
    return 'tooMany';
  }
  // Supabase uses one code for a wrong code and an expired one; the code's age tells them apart.
  if (error.code === 'otp_expired') return codeAgeMs >= CODE_LIFETIME_MS ? 'expired' : 'wrongCode';
  return 'unknown';
}

/** The calm message for a failure. Dev builds add the status and code (never the raw text) to find the cause. */
export function problemText(t: TFunction, error: unknown, codeAgeMs = 0): string {
  const text = t(`signIn.problem.${describeAuthError(error, codeAgeMs)}`);
  if (!__DEV__) return text;
  const detail = isAuthError(error) ? `${error.status ?? '-'} ${error.code ?? error.name}` : 'not-auth-error';
  return `${text}\n${t('signIn.devDetail', { detail })}`;
}

/** Emails a 6-digit code. A new email gets an account, so sign-up and sign-in are one flow. Throws on failure. */
export async function sendCode(email: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

/** Signs in with the emailed code. Only the session changes; local data is untouched until sync (2D). */
export async function verifyCode(email: string, token: string): Promise<void> {
  const { error } = await getSupabase().auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}
