'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-ink/50 backdrop-blur-[2px]',
        'data-[state=open]:animate-fade-in',
        'data-[state=closed]:pointer-events-none data-[state=closed]:animate-fade-out',
        className,
      )}
      {...props}
    />
  );
}

type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  /** `sheet` slides in from the right — used for the mobile filter panel. */
  variant?: 'center' | 'sheet' | 'full';
  closeLabel?: string;
};

export function DialogContent({
  className,
  children,
  variant = 'center',
  closeLabel = 'Close',
  ...props
}: DialogContentProps) {
  const [dismissible, setDismissible] = React.useState(false);

  React.useEffect(() => {
    const id = window.setTimeout(() => setDismissible(true), 400);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <DialogPrimitive.Portal>
      <DialogOverlay className={dismissible ? undefined : 'pointer-events-none'} />
      <DialogPrimitive.Content
        {...props}
        onPointerDownOutside={(event) => {
          if (!dismissible) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (!dismissible) event.preventDefault();
        }}
        className={cn(
          'fixed z-50 bg-surface text-ink shadow-pop focus:outline-none',
          variant === 'center' &&
            'left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-card border border-line p-6 data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
          variant === 'sheet' &&
            'inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right',
          variant === 'full' &&
            'inset-0 flex flex-col bg-ink/95 text-ink-inverse data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out',
          className,
        )}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            'absolute right-4 top-4 grid size-11 place-items-center rounded-full transition-colors',
            variant === 'full' ? 'bg-white/10 hover:bg-white/20' : 'hover:bg-surface-muted',
            !dismissible && 'pointer-events-none',
          )}
        >
          <X className="size-5" />
          <span className="sr-only">{closeLabel}</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mb-4 space-y-1 pr-10', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
  );
}
