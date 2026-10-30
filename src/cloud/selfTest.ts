import { randomUUID } from 'expo-crypto';

import { today } from '@/lib/dates';
import { readSetting, writeSetting } from '@/lib/storage';

import { getSupabase } from './supabase';

// Dev-only: the two-account security test from accounts-security §3.2, run against the real project.
// A creates a cloud row; B tries to read, change and delete it; A checks it is untouched and removes it.

const KEY = 'devSecurityTest';
const TEST_NAME = 'Kalma security test';

export type SelfTest = { trackerId: string; ownerId: string; verdict?: 'pass' | 'fail' };
export type Attempt = 'blocked' | 'allowed' | 'error';
export type AttackResult = { read: Attempt; change: Attempt; remove: Attempt };

export async function loadSelfTest(): Promise<SelfTest | null> {
  const saved = await readSetting(KEY);
  return saved ? (JSON.parse(saved) as SelfTest) : null;
}

export async function saveSelfTest(test: SelfTest | null): Promise<void> {
  await writeSetting(KEY, test ? JSON.stringify(test) : '');
}

/**
 * RLS hides other accounts' rows, so a blocked attempt comes back empty without an error.
 * Any error counts as "couldn't check", never as blocked: a signed-out request is also refused,
 * and that must not pass as proof that account B was stopped.
 */
export function judge(reply: { data: unknown[] | null; error: unknown }): Attempt {
  if (reply.error) return 'error';
  return reply.data && reply.data.length > 0 ? 'allowed' : 'blocked';
}

export function verdictOf(result: AttackResult): 'pass' | 'fail' | 'incomplete' {
  const attempts = [result.read, result.change, result.remove];
  if (attempts.includes('allowed')) return 'fail';
  return attempts.every((a) => a === 'blocked') ? 'pass' : 'incomplete';
}

/** As account A: one harmless cloud-only row. Local data is not touched. */
export async function createTestRow(ownerId: string): Promise<string> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const { error } = await getSupabase().from('trackers').insert({
    id,
    name: TEST_NAME,
    amount_centavos: 100,
    due_date: today(),
    recurrence: '{"type":"none"}',
    urgency: 'normal',
    notify: 0,
    status: 'active',
    user_id: ownerId,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  return id;
}

/** As account B: every attempt must come back empty. */
export async function attackTestRow(id: string): Promise<AttackResult> {
  const supabase = getSupabase();
  const read = judge(await supabase.from('trackers').select('id').eq('id', id));
  // A newer updated_at, so only RLS (not the "older change loses" rule) can stop it.
  const change = judge(
    await supabase
      .from('trackers')
      .update({ name: 'Changed by account B', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id'),
  );
  const remove = judge(await supabase.from('trackers').delete().eq('id', id).select('id'));
  return { read, change, remove };
}

/** As account A again: confirm B left the row alone, then delete it. */
export async function cleanUpTestRow(id: string): Promise<'unchanged' | 'changed' | 'missing'> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('trackers').select('name').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return 'missing';
  const removed = await supabase.from('trackers').delete().eq('id', id);
  if (removed.error) throw removed.error;
  return data.name === TEST_NAME ? 'unchanged' : 'changed';
}
