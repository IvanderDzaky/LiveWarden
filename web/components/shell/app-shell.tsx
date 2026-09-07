'use client';

import { Header } from './header';
import { Sidebar } from './sidebar';
import { usePathname } from 'next/navigation';

function getPageTitle(pathname: string): string {
  if (pathname === '/dashboard') return 'Overview';
  if (pathname === '/streams') return 'Streams Directory';
  if (pathname.startsWith('/streams/')) return 'Stream Detail';
  if (pathname === '/alerts') return 'Alert Queue';
  if (pathname === '/events') return 'Event Logs';
  return 'Operations';
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-blue-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="min-w-0 flex-1 flex flex-col">
        <Header title={pageTitle} />
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1400px] flex-1 p-4 outline-none sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
