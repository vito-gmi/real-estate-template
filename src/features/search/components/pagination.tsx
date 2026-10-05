import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { buttonVariants } from '@/components/ui/button';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import type { SearchFilters } from '../types';
import { buildSearchUrl, type SearchScope } from '../url';

/**
 * Keyset pagination controls.
 *
 * Cursors point forward only, so the cursors already visited are carried in the
 * `p` parameter to make "previous" a real link rather than a browser-history
 * trick. Both directions stay a single index seek, which is why page 50 loads
 * as quickly as page 1 — the property an OFFSET-based pager cannot offer.
 *
 * Plain links, so pagination works with JavaScript disabled and is crawlable.
 */
export async function Pagination({
  locale,
  scope,
  filters,
  cursor,
  previousCursors,
  nextCursor,
  pageNumber,
}: {
  locale: Locale;
  scope: SearchScope;
  filters: SearchFilters;
  cursor?: string;
  previousCursors: readonly string[];
  nextCursor: string | null;
  pageNumber: number;
}) {
  const t = await getTranslations('search');
  const tCommon = await getTranslations('common');

  if (!nextCursor && previousCursors.length === 0 && !cursor) return null;

  const previousHref = (() => {
    if (previousCursors.length === 0) return null;
    const stack = previousCursors.slice(0, -1);
    // An empty entry is the `first` sentinel: page one carries no cursor.
    const target = previousCursors.at(-1) || undefined;
    return buildSearchUrl(locale, scope, filters, {
      cursor: target,
      p: stack.join('.') || undefined,
    });
  })();

  const nextHref = nextCursor
    ? buildSearchUrl(locale, scope, filters, {
        cursor: nextCursor,
        p: [...previousCursors, cursor ?? 'first'].join('.'),
      })
    : null;

  const linkClass = cn(buttonVariants({ variant: 'outline', size: 'md' }), 'gap-1.5');

  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-4">
      {previousHref ? (
        <Link href={previousHref} rel="prev" className={linkClass}>
          <ChevronLeft />
          {tCommon('previous')}
        </Link>
      ) : (
        <span />
      )}

      <span className="text-sm text-ink-muted">{t('page', { page: pageNumber })}</span>

      {nextHref ? (
        <Link href={nextHref} rel="next" className={linkClass}>
          {tCommon('next')}
          <ChevronRight />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Decodes the visited-cursor stack carried in the `p` parameter. */
export function parseCursorStack(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split('.')
    .filter(Boolean)
    .map((value) => (value === 'first' ? '' : value))
    .slice(0, 50);
}
