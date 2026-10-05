'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');

  useEffect(() => {
    // The digest is the only safe correlator: the message itself may contain
    // details that must not be shown to a visitor.
    console.error('[public error]', error.digest ?? error.message);
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (dsn) {
      void import('@sentry/browser').then((Sentry) => Sentry.captureException(error));
    }
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-28 text-center">
      <AlertTriangle className="size-12 text-warning" aria-hidden="true" />
      <h1 className="mt-6 text-2xl font-semibold text-ink">{t('unexpected')}</h1>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-ink-subtle">{error.digest}</p>
      ) : null}
      <Button className="mt-8" onClick={reset}>
        {t('tryAgain')}
      </Button>
    </div>
  );
}
