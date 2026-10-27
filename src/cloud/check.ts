import { CloudConfigError, getSupabase } from './supabase';

export type CloudCheck = 'connected' | 'missingConfig' | 'notHttps' | 'offline' | 'badKey' | 'noTables' | 'unknown';

/** What a cloud reply means, in the words the dev "Cloud connection check" row shows. */
export function describeReply(error: { code?: string } | null, status: number): CloudCheck {
  // Signed out, the cloud must refuse to read trackers ("permission denied", 42501): that proves
  // the key works, the tables exist and they are locked.
  if (!error || error.code === '42501') return 'connected';
  if (error.code === 'PGRST205' || error.code === '42P01') return 'noTables';
  if (status === 401 || status === 403) return 'badKey';
  if (status === 0) return 'offline'; // the request never got an answer
  return 'unknown';
}

/** One harmless read of the trackers table, signed out. Never throws. */
export async function checkCloudConnection(): Promise<{ result: CloudCheck; code: string }> {
  try {
    const { error, status } = await getSupabase().from('trackers').select('id').limit(1);
    return { result: describeReply(error, status), code: error?.code || String(status) };
  } catch (error) {
    if (error instanceof CloudConfigError) {
      return { result: error.reason === 'missing' ? 'missingConfig' : 'notHttps', code: error.reason };
    }
    return { result: 'offline', code: 'fetch' };
  }
}
