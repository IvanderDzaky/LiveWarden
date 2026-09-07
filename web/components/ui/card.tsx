import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white shadow-2xs ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className = '',
  id
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 border-b border-slate-200 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div>
        <h3 id={id} className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 sm:p-5 ${className}`}>{children}</div>;
}
