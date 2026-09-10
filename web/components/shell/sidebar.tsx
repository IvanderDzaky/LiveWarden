'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ActivityIcon, AlertIcon, GridIcon, ShieldIcon, StreamIcon } from './icons';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: GridIcon },
  { href: '/streams', label: 'Streams', icon: StreamIcon },
  { href: '/alerts', label: 'Alerts', icon: AlertIcon },
  { href: '/events', label: 'Event Logs', icon: ActivityIcon }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 self-start border-r border-slate-200 bg-white lg:block" aria-label="Primary navigation">
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-white shadow-2xs">
          <ShieldIcon className="h-4.5 w-4.5" />
        </div>
        <div>
          <Link href="/dashboard" className="text-sm font-bold tracking-tight text-slate-900 block">
            LIVE WARDEN
          </Link>
          <span className="text-[10px] font-mono tracking-wider uppercase text-indigo-600">Operations</span>
        </div>
      </div>
      <nav className="space-y-1 p-3">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-bold border-l-2 border-indigo-600 pl-2.5'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
