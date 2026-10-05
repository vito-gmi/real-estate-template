import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium leading-none',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-sunken text-ink-muted',
        brand: 'bg-brand-soft text-brand',
        accent: 'bg-accent-soft text-accent-hover',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',
        solid: 'bg-ink text-ink-inverse',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
