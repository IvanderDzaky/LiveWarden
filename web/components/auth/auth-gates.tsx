'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../../lib/auth/provider';
import { LoadingState as UiLoadingState } from '../ui/loading-state';

function LoadingState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <UiLoadingState message="Checking session credentials..." />
    </main>
  );
}

export function ProtectedGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);
  if (loading || !user) return <LoadingState />;
  return children;
}

export function PublicGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);
  if (loading || user) return <LoadingState />;
  return children;
}
