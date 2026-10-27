import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { configureApiClient } from '../api/client';
import { getMe, logout as logoutRequest } from '../api/auth';
import type { User } from '../api/types';
import {
  deleteStoredToken,
  getStoredToken,
  setStoredToken,
} from './tokenStorage';

type AuthContextValue = {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  pendingPostRegisterSetup: boolean;
  markPostRegisterSetup: () => void;
  clearPostRegisterSetup: () => void;
  signInWithToken: (accessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPostRegisterSetup, setPendingPostRegisterSetup] =
    useState(false);
  const tokenRef = useRef<string | null>(null);

  const markPostRegisterSetup = useCallback(() => {
    setPendingPostRegisterSetup(true);
  }, []);

  const clearPostRegisterSetup = useCallback(() => {
    setPendingPostRegisterSetup(false);
  }, []);

  const clearSession = useCallback(async () => {
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    await deleteStoredToken();
  }, []);

  const loadUser = useCallback(async () => {
    const me = await getMe();
    setUser(me.data);
  }, []);

  const handleUnauthorized = useCallback(() => {
    void clearSession();
  }, [clearSession]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    configureApiClient({
      getToken: () => tokenRef.current,
      onUnauthorized: handleUnauthorized,
    });
  }, [handleUnauthorized]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const stored = await getStoredToken();
        if (!stored) {
          return;
        }
        tokenRef.current = stored;
        setToken(stored);
        await loadUser();
      } catch {
        await clearSession();
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [clearSession, loadUser]);

  const signInWithToken = useCallback(
    async (accessToken: string) => {
      await setStoredToken(accessToken);
      tokenRef.current = accessToken;
      setToken(accessToken);
      try {
        await loadUser();
      } catch (error) {
        await clearSession();
        throw error;
      }
    },
    [clearSession, loadUser],
  );

  const signOut = useCallback(async () => {
    try {
      if (tokenRef.current) {
        await logoutRequest();
      }
    } catch {
      // Still clear local session if the network call fails.
    }
    await clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      token,
      user,
      isLoading,
      pendingPostRegisterSetup,
      markPostRegisterSetup,
      clearPostRegisterSetup,
      signInWithToken,
      signOut,
    }),
    [
      token,
      user,
      isLoading,
      pendingPostRegisterSetup,
      markPostRegisterSetup,
      clearPostRegisterSetup,
      signInWithToken,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
