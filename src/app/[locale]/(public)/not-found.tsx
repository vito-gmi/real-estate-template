import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/routing';
import { homePath, searchPath } from '@/lib/routes';

export default async function NotFound() {
  const locale = (await getLocale()) as Locale;
  const [t, tNav] = await Promise.all([getTranslations('errors'), getTranslations('nav')]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-28 text-center">
      <SearchX className="size-12 text-ink-subtle" aria-hidden="true" />
      <h1 className="mt-6 text-2xl font-semibold text-ink">{t('notFound')}</h1>
      <p className="mt-2 text-ink-muted">{t('notFoundText')}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href={homePath(locale)}>{t('backHome')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={searchPath(locale, { deal: 'sale' })}>{tNav('buy')}</Link>
        </Button>
      </div>
    </div>
  );
}
