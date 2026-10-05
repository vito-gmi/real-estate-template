import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getListingCardsByIds } from '@/features/listings/queries';
import { locales } from '@/i18n/routing';
import { checkRateLimit, clientIp, hashIp } from '@/server/rate-limit';

/**
 * Hydrates a visitor's saved shortlist.
 *
 * Favourites live in the browser, so the ids arrive from the client and the
 * server returns the corresponding public listings. Only published listings are
 * ever returned, and the list is capped, so this cannot be used to enumerate
 * drafts or to pull the catalogue in one request.
 */

const MAX_IDS = 100;

const querySchema = z.object({
  locale: z.enum(locales),
  ids: z
    .string()
    .transform((raw) => raw.split(',').map((id) => id.trim()).filter(Boolean))
    .pipe(z.array(z.uuid()).max(MAX_IDS)),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    locale: request.nextUrl.searchParams.get('locale'),
    ids: request.nextUrl.searchParams.get('ids') ?? '',
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const limit = await checkRateLimit('search:ip', hashIp(await clientIp()));
  if (!limit.success) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } },
    );
  }

  const items = await getListingCardsByIds(parsed.data.locale, parsed.data.ids);

  return NextResponse.json(
    { items },
    {
      headers: {
        // Personal to the visitor's device: never store this in a shared cache.
        'cache-control': 'private, no-store',
      },
    },
  );
}
