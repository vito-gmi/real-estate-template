import * as React from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-sm text-ink',
        'placeholder:text-ink-subtle',
        'transition-[border-color,box-shadow] duration-150',
        'hover:border-ink-subtle',
        'focus-visible:border-brand-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/30',
        'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/25',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, rows = 5, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      rows={rows}
      className={cn(
        'flex w-full rounded-control border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink',
        'placeholder:text-ink-subtle resize-y',
        'focus-visible:border-brand-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/30',
        'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/25',
        className,
      )}
      {...props}
    />
  );
}
