import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { EncryptedSessionStorage } from './sessionStorage';

// The one Supabase client (accounts-security §1). Reads the project URL and the publishable
// (anon) key from .env. That key is safe in the app only because every cloud table has RLS on.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export class CloudConfigError extends Error {
  constructor(public readonly reason: 'missing' | 'notHttps') {
    super(`Cloud config: ${reason}`);
  }
}

let client: SupabaseClient | null = null;

/**
 * Created on first use, so a missing or wrong .env shows up as a clear error where the cloud
 * is used instead of crashing the app at startup. Throws CloudConfigError.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (!url || !anonKey) throw new CloudConfigError('missing');
  if (!url.startsWith('https://')) throw new CloudConfigError('notHttps'); // TLS only (§1.3)
  client = createClient(url, anonKey, {
    auth: {
      storage: new EncryptedSessionStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  // Supabase's React Native pattern: refresh the session only while the app is open.
  const auth = client.auth;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') auth.startAutoRefresh();
    else auth.stopAutoRefresh();
  });
  return client;
}
