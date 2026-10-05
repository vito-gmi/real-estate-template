import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { buildAlternates } from '@/lib/seo/metadata';
import { routeSlug, staticPath, type StaticRouteKey } from '@/lib/routes';

/**
 * Shared plumbing for the pages whose URL segment is translated.
 *
 * Each of these lives at two paths (`/bg/kontakti` and `/en/contact`), so every
 * route file is a four-line adapter over this: it guards against the wrong
 * locale reaching the wrong segment, sets the request locale, and produces
 * canonical plus hreflang metadata from one definition.
 */

export type SimplePageProps = {
  params: Promise<{ locale: Locale }>;
};

export function simplePageMetadata(
  key: StaticRouteKey,
  segmentLocale: Locale,
  title: (locale: Locale) => Promise<{ title: string; description: string }>,
) {
  return async ({ params }: SimplePageProps): Promise<Metadata> => {
    const { locale } = await params;
    if (locale !== segmentLocale) return {};

    const { title: pageTitle, description } = await title(locale);
    return {
      title: pageTitle,
      description,
      alternates: buildAlternates(locale, (target) => `/${routeSlug(key, target)}`),
    };
  };
}

/** Redirects `/en/kontakti` to `/en/contact` instead of serving a duplicate. */
export async function guardSegmentLocale(
  key: StaticRouteKey,
  segmentLocale: Locale,
  params: Promise<{ locale: Locale }>,
): Promise<Locale> {
  const { locale } = await params;
  if (locale !== segmentLocale) redirect(staticPath(key, locale));
  setRequestLocale(locale);
  return locale;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="border-b border-line bg-surface-muted">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-2 text-lg text-ink-muted">{subtitle}</p> : null}
      </div>
    </header>
  );
}
