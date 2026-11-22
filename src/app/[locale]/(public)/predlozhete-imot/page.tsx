import { getTranslations } from 'next-intl/server';
import { SubmitPropertyPage } from '@/features/submissions/pages/submit-page';
import { simplePageMetadata, type SimplePageProps } from '@/features/pages/simple-page';

const SEGMENT_LOCALE = 'bg' as const;

export const generateMetadata = simplePageMetadata('submit', SEGMENT_LOCALE, async (locale) => {
  const t = await getTranslations({ locale, namespace: 'submit' });
  return { title: t('title'), description: t('metaDescription') };
});

export default function Page(props: SimplePageProps) {
  return <SubmitPropertyPage {...props} segmentLocale={SEGMENT_LOCALE} />;
}
