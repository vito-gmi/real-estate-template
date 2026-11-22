import 'server-only';

import { countPublishedListings, listPublishedSlugs } from '@/features/listings/queries';
import { locales } from '@/i18n/routing';
import { dealTypes, propertyKinds } from '@/lib/domain/enums';
import { listingPath, searchPath, staticPath } from '@/lib/routes';
import { absolute } from '@/lib/seo/metadata';

/**
 * Sitemap generation.
 *
 * Hand-rolled rather than using the `sitemap.ts` file convention, because that
 * convention serves chunks at `/sitemap/[id].xml` without publishing a real
 * `/sitemap.xml` index — and `/sitemap.xml` is the path every crawler probes.
 * Owning the routes outright keeps the index, the chunking and the URL shape in
 * one place.
 *
 * Chunks stay well under the protocol's 50,000-URL limit; each listing
 * contributes one URL per locale.
 */

export const LISTINGS_PER_CHUNK = 20_000;

export type SitemapEntry = {
  readonly loc: string;
  readonly lastmod?: Date;
  readonly changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  readonly priority?: number;
};

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function renderUrlSet(entries: readonly SitemapEntry[]): string {
  const urls = entries
    .map((entry) =>
      [
        '  <url>',
        `    <loc>${escapeXml(entry.loc)}</loc>`,
        entry.lastmod ? `    <lastmod>${entry.lastmod.toISOString()}</lastmod>` : null,
        entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
        entry.priority !== undefined ? `    <priority>${entry.priority.toFixed(1)}</priority>` : null,
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export function renderSitemapIndex(chunkUrls: readonly string[], lastmod: Date): string {
  const items = chunkUrls
    .map(
      (url) =>
        `  <sitemap>\n    <loc>${escapeXml(url)}</loc>\n    <lastmod>${lastmod.toISOString()}</lastmod>\n  </sitemap>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>`;
}

/** Chunk 0 holds static and facet pages; listings begin at chunk 1. */
export async function countSitemapChunks(): Promise<number> {
  const total = await countPublishedListings();
  return 1 + Math.max(1, Math.ceil(total / LISTINGS_PER_CHUNK));
}

export function staticEntries(): SitemapEntry[] {
  const now = new Date();
  const entries: SitemapEntry[] = [];

  for (const locale of locales) {
    entries.push({ loc: absolute(`/${locale}`), lastmod: now, changefreq: 'daily', priority: 1 });

    for (const key of ['about', 'contact', 'submit', 'privacy', 'terms'] as const) {
      entries.push({
        loc: absolute(staticPath(key, locale)),
        lastmod: now,
        changefreq: 'yearly',
        priority: 0.3,
      });
    }

    for (const deal of dealTypes) {
      entries.push({
        loc: absolute(searchPath(locale, { deal })),
        lastmod: now,
        changefreq: 'daily',
        priority: 0.9,
      });

      for (const kind of propertyKinds) {
        entries.push({
          loc: absolute(searchPath(locale, { deal, kind })),
          lastmod: now,
          changefreq: 'daily',
          priority: 0.7,
        });
      }
    }
  }

  return entries;
}

export async function listingEntries(chunk: number): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];

  for (const locale of locales) {
    const rows = await listPublishedSlugs(locale, {
      limit: LISTINGS_PER_CHUNK,
      offset: chunk * LISTINGS_PER_CHUNK,
    });

    for (const row of rows) {
      entries.push({
        loc: absolute(listingPath(locale, row.slug)),
        lastmod: row.updatedAt,
        changefreq: 'weekly',
        priority: 0.8,
      });
    }
  }

  return entries;
}
