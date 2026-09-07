'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { AuthApiError, login, register } from '../../lib/api/auth';
import { useAuth } from '../../lib/auth/provider';
import { getSafeNextPath } from '../../lib/auth/redirect';
import { AlertBanner } from '../ui/alert-banner';
import { Button } from '../ui/button';
import { Card, CardBody } from '../ui/card';
import { ShieldIcon } from '../shell/icons';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const { setAuthenticatedUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isLogin = mode === 'login';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = isLogin ? await login(email, password) : await register(email, password);
      setAuthenticatedUser(result.user);
      const next =
        typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('next');
      router.replace(getSafeNextPath(next));
      router.refresh();
    } catch (cause) {
      const apiError = cause instanceof AuthApiError ? cause : null;
      setError({
        message:
          apiError?.code === 'CONFLICT'
            ? 'An account with this email already exists.'
            : isLogin
            ? 'Invalid email or password.'
            : 'Unable to create account.',
        requestId: apiError?.requestId
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 sm:p-6 font-sans">
      <Card className="w-full max-w-md shadow-sm">
        <CardBody className="p-6 sm:p-8">
          <div className="mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-600 text-white mb-4 shadow-2xs">
              <ShieldIcon className="h-6 w-6" />
            </div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600">Live Warden</p>
            <h1 id="auth-heading" className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {isLogin ? 'Sign in to Console' : 'Create Operator Account'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {isLogin
                ? 'Access livestream monitoring & NOC telemetry workspace.'
                : 'Start observing TikTok LIVE streams and real-time operational alerts.'}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5" noValidate>
            {error && (
              <AlertBanner
                variant="error"
                message={error.message}
                requestId={error.requestId}
              />
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-mono font-bold text-slate-300">
                EMAIL ADDRESS
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-mono font-bold text-slate-300">
                PASSWORD
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 disabled:bg-slate-100"
              />
            </div>

            <Button
              variant="primary"
              size="lg"
              type="submit"
              disabled={submitting}
              className="w-full"
            >
              {submitting ? 'Working...' : isLogin ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs font-medium text-slate-500">
            {isLogin ? 'Need an account?' : 'Already have an account?'}{' '}
            <Link
              href={isLogin ? '/register' : '/login'}
              className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              {isLogin ? 'Create one now' : 'Sign in'}
            </Link>
          </p>
        </CardBody>
      </Card>
    </main>
  );
}
