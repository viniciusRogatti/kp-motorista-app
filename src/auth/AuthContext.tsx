import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { clearStoredSession, readStoredSession, writeStoredSession } from './sessionStorage';
import type { DriverSession } from './types';
import { loginDriver, logoutDriver, validateDriverSession } from '@/services/auth';
import { stopDiagnosticTracking } from '@/tasks/backgroundLocation';

type AuthContextValue = {
  session: DriverSession | null;
  isLoading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<DriverSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const stored = await readStoredSession();
      if (!stored) {
        if (mounted) setIsLoading(false);
        return;
      }

      const validation = await validateDriverSession(stored.token);
      if (!mounted) return;
      if (validation === 'invalid') {
        await clearStoredSession();
      } else {
        setSession(stored);
      }
      if (mounted) setIsLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const nextSession = await loginDriver(username, password);
    await writeStoredSession(nextSession);
    setSession(nextSession);
  }, []);

  const signOut = useCallback(async () => {
    const token = session?.token;
    await stopDiagnosticTracking();
    await clearStoredSession();
    setSession(null);
    if (token) await logoutDriver(token);
  }, [session?.token]);

  const value = useMemo(() => ({ session, isLoading, signIn, signOut }), [isLoading, session, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth precisa estar dentro de AuthProvider.');
  return value;
}
