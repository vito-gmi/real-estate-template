import { legalDocuments } from '@/content/legal';
import { LegalPage } from '@/features/pages/legal-page';
import { simplePageMetadata, type SimplePageProps } from '@/features/pages/simple-page';

const SEGMENT_LOCALE = 'bg' as const;

export const generateMetadata = simplePageMetadata('privacy', SEGMENT_LOCALE, async (locale) => ({
  title: legalDocuments.privacy[locale].title,
  description: legalDocuments.privacy[locale].sections[0]?.paragraphs[0] ?? '',
}));

export default function Page(props: SimplePageProps) {
  return <LegalPage {...props} segmentLocale={SEGMENT_LOCALE} document="privacy" />;
}
