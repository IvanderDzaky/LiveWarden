'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentUser, logout as logoutRequest, type User } from '../api/auth';

type AuthState = { user: User | null; loading: boolean; setAuthenticatedUser: (user: User) => void; logout: () => Promise<void> };
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then(({ user: current }) => setUser(current)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    try { await logoutRequest(); } finally { setUser(null); }
  };

  return <AuthContext.Provider value={{ user, loading, setAuthenticatedUser: setUser, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
