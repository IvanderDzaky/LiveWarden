import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center font-semibold rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none shadow-2xs';

  const variantClasses = {
    primary: 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800',
    secondary: 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100',
    outline: 'bg-indigo-50/40 border-indigo-200 text-indigo-700 hover:bg-indigo-100 active:bg-indigo-200',
    danger: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 active:bg-rose-200',
    ghost: 'bg-transparent border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 shadow-none'
  };

  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-sm gap-2',
    lg: 'px-4 py-2.5 text-sm gap-2'
  };

  return (
    <button
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
