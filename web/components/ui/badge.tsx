import type { ReactNode } from 'react';

export interface BadgeProps {
  variant?: 'neutral' | 'emerald' | 'amber' | 'red' | 'blue' | 'indigo' | 'zinc';
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  const variantClasses = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    amber: 'bg-amber-50 text-amber-800 border-amber-200/80',
    red: 'bg-red-50 text-rose-800 border-red-200/80',
    blue: 'bg-blue-50 text-blue-800 border-blue-200/80',
    indigo: 'bg-indigo-50 text-indigo-800 border-indigo-200/80',
    zinc: 'bg-zinc-100 text-zinc-700 border-zinc-200'
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold tracking-tight ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
