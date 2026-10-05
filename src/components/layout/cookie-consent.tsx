'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/routing';
import { staticPath } from '@/lib/routes';

const STORAGE_KEY = 'estate:cookie-consent:v1';

export type ConsentChoice = 'accepted' | 'declined';

export function readConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === 'accepted' || value === 'declined' ? value : null;
}

/**
 * Consent gate for non-essential cookies.
 *
 * The site sets no analytics cookies until this returns "accepted", which is
 * what the GDPR actually requires — a banner that loads trackers before you
 * answer it is worse than no banner. Rendered after hydration so it never
 * appears in the cached HTML and never shifts the layout of the page beneath.
 */
export function CookieConsent() {
  const t = useTranslations('cookies');
  const locale = useLocale() as Locale;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readConsent() === null);
  }, []);

  if (!visible) return null;

  const choose = (choice: ConsentChoice) => {
    window.localStorage.setItem(STORAGE_KEY, choice);
    window.dispatchEvent(new CustomEvent('estate:consent', { detail: choice }));
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-3 bottom-3 z-50 rounded-card border border-line bg-surface p-5 shadow-pop sm:left-auto sm:right-4 sm:max-w-md"
    >
      <h2 id="cookie-consent-title" className="text-sm font-semibold text-ink">
        {t('title')}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">{t('text')}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => choose('accepted')}>
          {t('accept')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => choose('declined')}>
          {t('decline')}
        </Button>
        <Link
          href={staticPath('privacy', locale)}
          className="ml-auto text-xs text-ink-subtle underline underline-offset-4 hover:text-brand"
        >
          {t('learnMore')}
        </Link>
      </div>
    </div>
  );
}
