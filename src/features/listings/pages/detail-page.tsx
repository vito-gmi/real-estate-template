import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Phone } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { siteConfig } from '@/config/site';
import { FavoriteButton } from '@/features/favorites/favorite-button';
import { InquiryForm } from '@/features/inquiries/components/inquiry-form';
import {
  getListingByIdUncached,
  getListingBySlug,
  getSimilarListings,
  listPublishedSlugs,
} from '@/features/listings/queries';
import type { Locale } from '@/i18n/routing';
import { hasIndoorArea } from '@/lib/domain/enums';
import { formatArea, formatDate, formatNumber, formatPrice, formatPricePerSqm } from '@/lib/format';
import { homePath, listingPath, searchPath } from '@/lib/routes';
import { breadcrumbJsonLd, JsonLd, listingJsonLd } from '@/lib/seo/json-ld';
import { absolute, truncateForMeta } from '@/lib/seo/metadata';
import { verifySignedToken } from '@/lib/signing';
import { Gallery } from '../components/gallery';
import { ListingCard } from '../components/listing-card';
import { MortgageCalculator } from '../components/mortgage-calculator';
import { PropertyMap } from '../components/property-map';
import { ShareButton } from '../components/share-button';
import type { ListingDetailDto } from '../dto';

/**
 * The listing detail page.
 *
 * Rendered by two thin route files — `/bg/imot/[slug]` and `/en/property/[slug]`
 * — because the URL segment is translated. Both delegate here, so there is one
 * implementation and one place to change it.
 */

export type DetailPageProps = {
  params: Promise<{ locale: Locale; slug: string }>;
  searchParams: Promise<{ preview?: string }>;
  /** Locale this route file's URL segment belongs to. */
  segmentLocale: Locale;
};

/** How many of the newest listings are prerendered at build time. */
const PRERENDER_COUNT = 100;

/**
 * Prerenders the most recent listings so the pages most likely to be hit first
 * — by a crawler or by someone clicking a fresh link — are already on the CDN.
 * Everything older is generated on demand and cached from then on.
 *
 * A build must never fail because the database was briefly unreachable, so a
 * failure here degrades to "prerender nothing" rather than aborting the deploy.
 */
export async function generateListingParams(segmentLocale: Locale) {
  try {
    const rows = await listPublishedSlugs(segmentLocale, { limit: PRERENDER_COUNT, offset: 0 });
    return rows.map((row) => ({ locale: segmentLocale, slug: row.slug }));
  } catch (error) {
    console.warn('[generateStaticParams] skipping listing prerender:', error);
    return [];
  }
}

async function loadListing(
  locale: Locale,
  slug: string,
  previewToken: string | undefined,
) {
  // Request-time: a prerender of this slug would bake a 404 and ignore `?preview=`.
  await connection();

  const published = await getListingBySlug(locale, slug);
  if (published) return { result: published, isPreview: false };

  if (!previewToken) return { result: null, isPreview: false };

  const listingId = verifySignedToken('preview', previewToken);
  if (!listingId) return { result: null, isPreview: false };

  const draft = await getListingByIdUncached(locale, listingId, { includeUnpublished: true });
  if (!draft) return { result: null, isPreview: false };

  if (draft.listing.slug !== slug) {
    redirect(`${listingPath(locale, draft.listing.slug)}?preview=${encodeURIComponent(previewToken)}`);
  }

  return { result: draft, isPreview: true };
}

export async function generateListingMetadata({
  params,
  searchParams,
  segmentLocale,
}: DetailPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (locale !== segmentLocale) return {};

  const previewToken = (await searchParams).preview;
  const { result, isPreview } = await loadListing(locale, slug, previewToken);
  if (!result) return {};

  const { listing } = result;
  const title = listing.metaTitle ?? listing.title;
  const description = listing.metaDescription ?? truncateForMeta(listing.description);
  const canonical = absolute(listingPath(locale, listing.slug));

  return {
    title,
    description,
    // Only the active locale is declared: the slug in the other language belongs
    // to the same listing but is a different string, and claiming a URL that
    // may not exist would be worse than omitting it.
    alternates: { canonical },
    robots: isPreview ? { index: false, follow: false } : undefined,
    // `images` is intentionally omitted: the colocated `opengraph-image` route
    // is discovered by Next and its hashed URL injected automatically, which is
    // the only way to get correct cache-busting.
    openGraph: { type: 'website', title, description, url: canonical },
  };
}

export async function ListingDetailPage({ params, searchParams, segmentLocale }: DetailPageProps) {
  const { locale, slug } = await params;

  // `/en/imot/...` is a valid-looking but wrong URL; send it to its canonical
  // form rather than serving the same content at two addresses.
  if (locale !== segmentLocale) redirect(listingPath(locale, slug));

  setRequestLocale(locale);

  const previewToken = (await searchParams).preview;
  const { result, isPreview } = await loadListing(locale, slug, previewToken);
  if (!result) notFound();

  const { listing, internal } = result;

  const [t, tEnum, tCommon, tAdmin, similar] = await Promise.all([
    getTranslations('listing'),
    getTranslations('enums'),
    getTranslations('common'),
    getTranslations('admin'),
    getSimilarListings(locale, internal, 3),
  ]);

  const canonical = absolute(listingPath(locale, listing.slug));
  const crumbs = [
    { name: tCommon('search'), href: homePath(locale) },
    {
      name: tEnum(`propertyKindPlural.${listing.kind}`),
      href: searchPath(locale, { deal: listing.dealType, kind: listing.kind }),
    },
    ...(listing.city
      ? [
          {
            name: listing.city.name,
            href: searchPath(locale, {
              deal: listing.dealType,
              kind: listing.kind,
              citySlug: listing.city.slug,
            }),
          },
        ]
      : []),
    { name: listing.title, href: '' },
  ];

  const specs = buildSpecs(locale, listing, t, tEnum);

  return (
    <article className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {isPreview ? (
        <div
          role="status"
          className="mb-6 rounded-card border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink"
        >
          {tAdmin('previewBanner')}
        </div>
      ) : null}
      <JsonLd data={listingJsonLd(listing, canonical)} />
      <JsonLd data={breadcrumbJsonLd(crumbs)} />

      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-ink-subtle">
          {crumbs.map((crumb, index) => (
            <li key={`${crumb.name}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-brand">
                  {crumb.name}
                </Link>
              ) : (
                <span className="line-clamp-1 text-ink-muted">{crumb.name}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone="solid">{tEnum(`dealTypeShort.${listing.dealType}`)}</Badge>
            <Badge tone="neutral">{tEnum(`propertyKind.${listing.kind}`)}</Badge>
            {listing.isExclusive ? <Badge tone="brand">Exclusive</Badge> : null}
            {listing.status === 'reserved' ? (
              <Badge tone="warning">{tEnum('status.reserved')}</Badge>
            ) : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {listing.title}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {[listing.city?.name, listing.district?.name, listing.address].filter(Boolean).join(', ')}
            <span className="ml-2 text-ink-subtle">
              · {t('reference')} {listing.reference}
            </span>
          </p>
        </div>
        <FavoriteButton listingId={listing.id} variant="inline" className="relative z-10 mt-1" />
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-10">
          <Gallery photos={listing.photos} title={listing.title} />

          <section aria-labelledby="overview">
            <h2 id="overview" className="text-lg font-semibold text-ink">
              {t('overview')}
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              {specs.map((spec) => (
                <div key={spec.label} className="border-b border-line pb-3">
                  <dt className="text-xs uppercase tracking-wide text-ink-subtle">{spec.label}</dt>
                  <dd className="mt-1 font-medium text-ink">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {listing.description ? (
            <section aria-labelledby="description">
              <h2 id="description" className="text-lg font-semibold text-ink">
                {t('description')}
              </h2>
              <div className="mt-3 space-y-3 leading-relaxed text-ink-muted">
                {listing.description.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </section>
          ) : null}

          {listing.features.length > 0 ? (
            <section aria-labelledby="features">
              <h2 id="features" className="text-lg font-semibold text-ink">
                {t('features')}
              </h2>
              <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
                {listing.features.map((feature) => (
                  <li key={feature.key} className="flex items-center gap-2 text-sm text-ink-muted">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
                    {feature.name}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {listing.floorPlans.length > 0 ? (
            <section aria-labelledby="floorplan">
              <h2 id="floorplan" className="text-lg font-semibold text-ink">
                {t('floorPlan')}
              </h2>
              <div className="mt-4">
                <Gallery photos={listing.floorPlans} title={t('floorPlan')} />
              </div>
            </section>
          ) : null}

          {siteConfig.features.mapOnDetailPage && listing.map ? (
            <section aria-labelledby="location">
              <h2 id="location" className="mb-4 text-lg font-semibold text-ink">
                {t('location')}
              </h2>
              <PropertyMap
                lat={listing.map.lat}
                lng={listing.map.lng}
                approximate={listing.map.approximate}
                label={`${listing.title} — ${t('location')}`}
              />
            </section>
          ) : null}

          {siteConfig.features.mortgageCalculator && listing.dealType === 'sale' && listing.price ? (
            <MortgageCalculator price={listing.price.amount} currency={listing.price.currency} />
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
            <div>
              <p className="text-3xl font-semibold tracking-tight text-ink">
                {listing.price ? (
                  <>
                    {formatPrice(locale, listing.price.amount, listing.price.currency)}
                    {listing.dealType === 'rent' ? (
                      <span className="ml-1 text-base font-normal text-ink-muted">/{t('monthly')}</span>
                    ) : null}
                  </>
                ) : (
                  t('priceOnRequest')
                )}
              </p>
              {listing.price?.perSqmEur ? (
                <p className="mt-1 text-sm text-ink-muted">
                  {formatPricePerSqm(locale, listing.price.perSqmEur)}
                </p>
              ) : null}
            </div>

            <ShareButton title={listing.title} className="w-full" />

            <a
              href={siteConfig.contact.phoneHref}
              className="flex items-center justify-center gap-2 rounded-control bg-brand px-4 py-3 font-medium text-ink-inverse transition-colors hover:bg-brand-hover"
            >
              <Phone className="size-4" />
              {siteConfig.contact.phone}
            </a>

            {siteConfig.features.inquiryForm ? (
              <div className="border-t border-line pt-4">
                <InquiryForm listingId={listing.id} defaultKind="viewing" compact />
              </div>
            ) : null}

            <p className="text-xs text-ink-subtle">
              {t('updatedOn')} {formatDate(locale, new Date(listing.updatedAt))}
            </p>
          </div>
        </aside>
      </div>

      {similar.length > 0 ? (
        <section className="mt-16" aria-labelledby="similar">
          <h2 id="similar" className="text-lg font-semibold text-ink">
            {t('similar')}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{t('similarSubtitle')}</p>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((item) => (
              <li key={item.id}>
                <ListingCard locale={locale} listing={item} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

function buildSpecs(
  locale: Locale,
  listing: ListingDetailDto,
  t: Translate,
  tEnum: Translate,
): { label: string; value: string }[] {
  const specs: { label: string; value: string }[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value) specs.push({ label, value });
  };

  if (hasIndoorArea(listing.kind)) {
    add(t('totalArea'), listing.area ? formatArea(locale, listing.area) : null);
  }
  add(t('landArea'), listing.landArea ? formatArea(locale, listing.landArea) : null);
  add(t('rooms'), listing.rooms ? formatNumber(locale, listing.rooms) : null);
  add(t('bedrooms'), listing.bedrooms ? formatNumber(locale, listing.bedrooms) : null);
  add(t('bathrooms'), listing.bathrooms ? formatNumber(locale, listing.bathrooms) : null);
  add(
    t('floor'),
    listing.floor !== null
      ? listing.floorsTotal
        ? t('floorOf', { floor: listing.floor, total: listing.floorsTotal })
        : String(listing.floor)
      : null,
  );
  add(t('yearBuilt'), listing.yearBuilt ? String(listing.yearBuilt) : null);
  add(t('construction'), listing.constructionType ? tEnum(`construction.${listing.constructionType}`) : null);
  add(t('heating'), listing.heating ? tEnum(`heating.${listing.heating}`) : null);
  add(t('furnishing'), listing.furnishing ? tEnum(`furnishing.${listing.furnishing}`) : null);
  add(t('condition'), listing.condition ? tEnum(`condition.${listing.condition}`) : null);
  add(t('energyLabel'), listing.energyLabel);

  if (listing.dealType === 'rent') {
    add(
      t('maintenanceFee'),
      listing.maintenanceFee
        ? `${formatPrice(locale, listing.maintenanceFee, listing.price?.currency)} / ${t('monthly')}`
        : null,
    );
    add(
      t('deposit'),
      listing.depositMonths ? t('depositMonths', { count: listing.depositMonths }) : null,
    );
    add(
      t('availableFrom'),
      listing.availableFrom ? formatDate(locale, new Date(listing.availableFrom)) : null,
    );
  }

  return specs;
}
