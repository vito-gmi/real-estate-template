import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';
import type { Locale } from '@/i18n/routing';
import { staticPath } from '@/lib/routes';
import { JsonLd, organizationJsonLd } from '@/lib/seo/json-ld';
import { guardSegmentLocale, PageHeader } from './simple-page';

export async function AboutPage({
  params,
  segmentLocale,
}: {
  params: Promise<{ locale: Locale }>;
  segmentLocale: Locale;
}) {
  const locale = await guardSegmentLocale('about', segmentLocale, params);
  const [t, tHome, tNav] = await Promise.all([
    getTranslations('about'),
    getTranslations('home'),
    getTranslations('nav'),
  ]);

  return (
    <>
      <JsonLd data={organizationJsonLd(locale)} />
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-lg leading-relaxed text-ink-muted">{tHome('heroSubtitle')}</p>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          <Value title={tHome('whyVerifiedTitle')} text={tHome('whyVerifiedText')} />
          <Value title={tHome('whyTransparentTitle')} text={tHome('whyTransparentText')} />
          <Value title={tHome('whySupportTitle')} text={tHome('whySupportText')} />
        </div>

        <div className="mt-12 rounded-card border border-line bg-surface p-6">
          <h2 className="font-semibold text-ink">{siteConfig.legalName}</h2>
          <p className="mt-2 text-sm text-ink-muted">
            {siteConfig.offices.map((office) => `${office.city[locale]}, ${office.address[locale]}`).join(' · ')}
          </p>
          <Button asChild className="mt-5">
            <Link href={staticPath('contact', locale)}>{tNav('contact')}</Link>
          </Button>
        </div>
      </div>
    </>
  );
}

function Value({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{text}</p>
    </div>
  );
}
