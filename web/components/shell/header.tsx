'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '../../lib/auth/provider';
import { Button } from '../ui/button';
import { LogOutIcon } from './icons';
import { MobileNav } from './mobile-nav';

export function Header({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const signOut = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-8">
      <div className="flex items-center gap-3">
        <MobileNav />
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-indigo-600">OPERATIONS</p>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">{title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden text-right sm:block">
          <p className="text-xs font-semibold text-slate-900">{user?.email}</p>
          <p className="text-[11px] font-mono text-slate-500">Monitoring Console</p>
        </div>
        <Button variant="secondary" size="sm" onClick={signOut} disabled={loggingOut}>
          <LogOutIcon className="h-3.5 w-3.5 text-slate-400" />
          {loggingOut ? 'Signing out...' : 'Sign out'}
        </Button>
      </div>
    </header>
  );
}
