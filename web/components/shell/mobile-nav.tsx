'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ActivityIcon, AlertIcon, CloseIcon, GridIcon, MenuIcon, StreamIcon } from './icons';

const links = [
  { href: '/dashboard', label: 'Overview', icon: GridIcon },
  { href: '/streams', label: 'Streams', icon: StreamIcon },
  { href: '/alerts', label: 'Alerts', icon: AlertIcon },
  { href: '/events', label: 'Logs', icon: ActivityIcon }
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <div className="lg:hidden">
        <button
          type="button"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="rounded-md border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>

        {open && (
          <div className="absolute inset-x-0 top-16 z-30 border-b border-slate-200 bg-white p-3 shadow-md">
            <nav aria-label="Mobile menu" className="space-y-1">
              {links.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
                return (
                  <Link
                    onClick={() => setOpen(false)}
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
          </div>
        )}
      </div>
    </div>
  );
}
