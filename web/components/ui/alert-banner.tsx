import type { ReactNode } from 'react';

export function AlertBanner({
  variant = 'error',
  message,
  requestId,
  retry,
  children
}: {
  variant?: 'error' | 'success' | 'warning' | 'info';
  message?: string;
  requestId?: string;
  retry?: () => void;
  children?: ReactNode;
}) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    info: 'border-blue-200 bg-blue-50 text-blue-900'
  };

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`rounded-md border p-4 text-sm font-medium ${styles[variant]}`}
    >
      {message && <p className="font-semibold">{message}</p>}
      {children}
      {requestId && (
        <p className="mt-1 font-mono text-xs opacity-75">Request ID: {requestId}</p>
      )}
      {retry && (
        <button
          type="button"
          onClick={retry}
          className="mt-2.5 inline-flex items-center text-xs font-bold underline underline-offset-2 hover:opacity-80"
        >
          Try again
        </button>
      )}
    </div>
  );
}
