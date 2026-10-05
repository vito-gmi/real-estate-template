import { getTranslations } from 'next-intl/server';
import { AboutPage } from '@/features/pages/about-page';
import { simplePageMetadata, type SimplePageProps } from '@/features/pages/simple-page';

const SEGMENT_LOCALE = 'bg' as const;

export const generateMetadata = simplePageMetadata('about', SEGMENT_LOCALE, async (locale) => {
  const t = await getTranslations({ locale, namespace: 'about' });
  return { title: t('title'), description: t('subtitle') };
});

export default function Page(props: SimplePageProps) {
  return <AboutPage {...props} segmentLocale={SEGMENT_LOCALE} />;
}
