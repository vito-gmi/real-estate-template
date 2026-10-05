import { getTranslations } from 'next-intl/server';
import { ContactPage } from '@/features/pages/contact-page';
import { simplePageMetadata, type SimplePageProps } from '@/features/pages/simple-page';

const SEGMENT_LOCALE = 'bg' as const;

export const generateMetadata = simplePageMetadata('contact', SEGMENT_LOCALE, async (locale) => {
  const t = await getTranslations({ locale, namespace: 'contact' });
  return { title: t('title'), description: t('subtitle') };
});

export default function Page(props: SimplePageProps) {
  return <ContactPage {...props} segmentLocale={SEGMENT_LOCALE} />;
}
