import type { User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getSupabase } from './supabase';

type SessionState = { loading: boolean; user: User | null };

const SessionContext = createContext<SessionState>({ loading: true, user: null });

/** Who is signed in. The saved session is restored on start, so users stay signed in across restarts. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ loading: true, user: null });

  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabase();
    } catch {
      setState({ loading: false, user: null }); // cloud not set up: guest only
      return;
    }
    // Fires once with the restored session, then on every sign-in, sign-out and refresh.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ loading: false, user: session?.user ?? null });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
