import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, BadgeCheck, HandCoins, ShieldCheck } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';
import { ListingCard } from '@/features/listings/components/listing-card';
import {
  getPopularCities,
  getShowcaseListings,
  countPublishedListings,
} from '@/features/listings/queries';
import { HeroSearch } from '@/features/search/components/hero-search';
import { isLocale } from '@/i18n/routing';
import { propertyKinds } from '@/lib/domain/enums';
import { formatNumber } from '@/lib/format';
import { searchPath } from '@/lib/routes';
import { buildAlternates } from '@/lib/seo/metadata';
import { JsonLd, organizationJsonLd } from '@/lib/seo/json-ld';
import type { Metadata } from 'next';

/** Regenerated in the background; a visitor never waits for a rebuild. */
export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'home' });

  return {
    title: `${siteConfig.name} — ${t('heroTitle')}`,
    description: t('heroSubtitle'),
    alternates: buildAlternates(locale, () => '/'),
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const [t, tEnum, featured, newest, cities, total] = await Promise.all([
    getTranslations('home'),
    getTranslations('enums'),
    getShowcaseListings(locale, { featuredOnly: true, limit: 6 }),
    getShowcaseListings(locale, { limit: 6 }),
    getPopularCities(locale, 8),
    countPublishedListings(),
  ]);

  const showcase = featured.length >= 3 ? featured : newest;

  return (
    <>
      <JsonLd data={organizationJsonLd(locale)} />

      <section className="relative isolate overflow-hidden border-b border-line bg-gradient-to-br from-brand-soft via-canvas to-accent-soft">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
              {t('heroTitle')}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-ink-muted">{t('heroSubtitle')}</p>
          </div>

          <div className="mt-10">
            <HeroSearch cities={cities.map((city) => ({ slug: city.slug, name: city.name }))} />
          </div>

          <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
            <Stat value={formatNumber(locale, total)} label={t('statsListings')} />
            <Stat value={formatNumber(locale, cities.length)} label={t('statsCities')} />
            <Stat value="15+" label={t('statsExperience')} />
          </dl>
        </div>
      </section>

      <Section
        title={t('featuredTitle')}
        subtitle={t('featuredSubtitle')}
        action={{ href: searchPath(locale, { deal: 'sale' }), label: t('viewAll') }}
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {showcase.map((listing, index) => (
            <ListingCard key={listing.id} locale={locale} listing={listing} priority={index < 3} />
          ))}
        </div>
      </Section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{t('browseByKind')}</h2>
        <ul className="mt-6 flex flex-wrap gap-3">
          {propertyKinds.map((kind) => (
            <li key={kind}>
              <Link
                href={searchPath(locale, { deal: 'sale', kind })}
                className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:border-brand hover:text-brand"
              >
                {tEnum(`propertyKindPlural.${kind}`)}
              </Link>
            </li>
          ))}
        </ul>

        <h2 className="mt-12 text-2xl font-semibold tracking-tight text-ink">{t('browseByCity')}</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cities.map((city) => (
            <li key={city.id}>
              <Link
                href={searchPath(locale, { deal: 'sale', citySlug: city.slug })}
                className="flex items-center justify-between rounded-control border border-line bg-surface px-4 py-3 text-sm transition-colors hover:border-brand"
              >
                <span className="font-medium text-ink">{city.name}</span>
                <span className="text-ink-subtle">{formatNumber(locale, city.listingCount)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {newest.length > 0 ? (
        <Section
          title={t('newestTitle')}
          subtitle={t('newestSubtitle')}
          action={{ href: searchPath(locale, { deal: 'sale' }), label: t('viewAll') }}
        >
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {newest.map((listing) => (
              <ListingCard key={listing.id} locale={locale} listing={listing} />
            ))}
          </div>
        </Section>
      ) : null}

      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{t('whyTitle')}</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <ValueProp icon={BadgeCheck} title={t('whyVerifiedTitle')} text={t('whyVerifiedText')} />
          <ValueProp icon={HandCoins} title={t('whyTransparentTitle')} text={t('whyTransparentText')} />
          <ValueProp icon={ShieldCheck} title={t('whySupportTitle')} text={t('whySupportText')} />
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="block text-2xl font-semibold text-ink">{value}</span>
        <span className="text-sm text-ink-muted">{label}</span>
      </dd>
    </div>
  );
}

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">{title}</h2>
          <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={action.href}>
            {action.label}
            <ArrowRight />
          </Link>
        </Button>
      </div>
      {children}
    </section>
  );
}

function ValueProp({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-6">
      <Icon className="size-6 text-brand" aria-hidden="true" />
      <h3 className="mt-4 font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{text}</p>
    </div>
  );
}
