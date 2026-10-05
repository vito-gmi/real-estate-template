'use client';

import { useEffect, useState } from 'react';
import type { ListingCardDto } from '@/features/listings/dto';
import type { Locale } from '@/i18n/routing';

type State =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; items: readonly ListingCardDto[] }
  | { status: 'error' };

/**
 * Fetches the listings behind a set of ids.
 *
 * Favourites are only known to the browser, so this is the one place on the
 * public site that loads content after hydration. Ids that no longer resolve —
 * a property that has since been sold and archived — are simply absent from the
 * response, which is the correct behaviour: the shortlist quietly shrinks.
 */
export function useFavoriteListings(locale: Locale, ids: readonly string[]): State {
  const [state, setState] = useState<State>(() =>
    ids.length === 0 ? { status: 'ready', items: [] } : { status: 'idle' },
  );
  const key = ids.join(',');

  useEffect(() => {
    if (ids.length === 0) {
      setState({ status: 'ready', items: [] });
      return;
    }

    const controller = new AbortController();
    setState({ status: 'loading' });

    fetch(`/api/listings/by-ids?locale=${locale}&ids=${encodeURIComponent(key)}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('request failed'))))
      .then((body: { items: ListingCardDto[] }) => setState({ status: 'ready', items: body.items }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error' });
      });

    return () => controller.abort();
    // `key` is the stable, order-sensitive identity of the id list.
  }, [key, locale, ids.length]);

  return state;
}
