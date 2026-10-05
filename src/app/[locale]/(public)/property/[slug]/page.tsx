import type { Metadata } from 'next';
import {
  generateListingMetadata,
  generateListingParams,
  ListingDetailPage,
  type DetailPageProps,
} from '@/features/listings/pages/detail-page';

/** English detail URL: `/en/property/[slug]`. */
const SEGMENT_LOCALE = 'en' as const;

/**
 * Drafts, new publishes, and signed preview links are never in
 * `generateStaticParams`. `force-dynamic` keeps `?preview=` visible: a
 * statically generated 404 for a draft slug would be served forever and
 * ignore the token. Published HTML is still cached at the CDN via
 * `src/proxy.ts`.
 */
export const dynamicParams = true;
export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return generateListingParams(SEGMENT_LOCALE);
}

export function generateMetadata(props: Omit<DetailPageProps, 'segmentLocale'>): Promise<Metadata> {
  return generateListingMetadata({ ...props, segmentLocale: SEGMENT_LOCALE });
}

export default async function Page(props: Omit<DetailPageProps, 'segmentLocale'>) {
  // Touch searchParams at the page boundary so Next cannot prerender this
  // route without the query string (draft preview tokens live there).
  await props.searchParams;
  return <ListingDetailPage {...props} segmentLocale={SEGMENT_LOCALE} />;
}
