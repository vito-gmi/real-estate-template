'use client';

import { useEffect } from 'react';
import { clientEnv } from '@/env';
import { readConsent } from '@/components/layout/cookie-consent';

let started = false;

async function startSentry() {
  if (started) return;
  const dsn = clientEnv.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  started = true;

  const Sentry = await import('@sentry/browser');
  Sentry.init({
    dsn,
    tracesSampleRate: 0.05,
    replaysSessionSampleRate: 0,
    sendDefaultPii: false,
  });
}

/**
 * Loads the Sentry browser SDK only after analytics consent, which is what the
 * GDPR requires for a third-party error reporter that sets cookies.
 */
export function SentryInit() {
  useEffect(() => {
    if (readConsent() === 'accepted') void startSentry();

    const onConsent = (event: Event) => {
      const choice = (event as CustomEvent<string>).detail;
      if (choice === 'accepted') void startSentry();
    };
    window.addEventListener('estate:consent', onConsent);
    return () => window.removeEventListener('estate:consent', onConsent);
  }, []);

  return null;
}
