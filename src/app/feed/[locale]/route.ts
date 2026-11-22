import { notFound } from 'next/navigation';
import { siteConfig } from '@/config/site';
import { searchListings } from '@/features/listings/queries';
import { parseSearchFilters } from '@/features/search/params';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { routing, type Locale } from '@/i18n/routing';
import { formatPrice } from '@/lib/format';
import { fallbackSrc } from '@/lib/media-url';
import { listingPath } from '@/lib/routes';
import { absolute } from '@/lib/seo/metadata';

/**
 * RSS feed for a search.
 *
 * Saved-search email alerts would need visitor accounts, and this template
 * deliberately has none. A feed gives the same "tell me when something new
 * matches" capability with no signup, no stored personal data and no sending
 * infrastructure — the query string accepts the same filters as the search page.
 */

export const revalidate = 900;

const FEED_SIZE = 40;

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale: raw } = await params;
  if (!hasLocale(routing.locales, raw)) notFound();
  const locale = raw as Locale;

  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams.entries());
  const dealType = searchParams.deal === 'rent' ? 'rent' : 'sale';

  const filters = parseSearchFilters({ dealType, searchParams });
  const [page, t] = await Promise.all([
    searchListings(locale, filters, undefined, FEED_SIZE),
    getTranslations({ locale, namespace: 'listing' }),
  ]);

  const title = `${siteConfig.name} — ${dealType === 'sale' ? 'sale' : 'rent'}`;
  const selfUrl = absolute(`${url.pathname}${url.search}`);

  const items = page.items
    .map((listing) => {
      const link = absolute(listingPath(locale, listing.slug));
      const image = listing.cover ? fallbackSrc(listing.cover.variants) : null;
      const place = [listing.city?.name, listing.district?.name].filter(Boolean).join(', ');
      const description = [
        listing.price
          ? formatPrice(locale, listing.price.amount, listing.price.currency)
          : t('priceOnRequest'),
        place,
        `ID ${listing.reference}`,
      ]
        .filter(Boolean)
        .join(' · ');

      return `    <item>
      <title>${escapeXml(listing.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <description>${escapeXml(description)}</description>
      ${listing.publishedAt ? `<pubDate>${new Date(listing.publishedAt).toUTCString()}</pubDate>` : ''}
      ${image ? `<enclosure url="${escapeXml(image.startsWith('http') ? image : absolute(image))}" type="image/webp" />` : ''}
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(absolute(`/${locale}`))}</link>
    <description>${escapeXml(siteConfig.name)}</description>
    <language>${locale}</language>
    <atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, s-maxage=900, stale-while-revalidate=86400',
    },
  });
}
