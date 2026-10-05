import { legalDocuments } from '@/content/legal';
import { LegalPage } from '@/features/pages/legal-page';
import { simplePageMetadata, type SimplePageProps } from '@/features/pages/simple-page';

const SEGMENT_LOCALE = 'en' as const;

export const generateMetadata = simplePageMetadata('terms', SEGMENT_LOCALE, async (locale) => ({
  title: legalDocuments.terms[locale].title,
  description: legalDocuments.terms[locale].sections[0]?.paragraphs[0] ?? '',
}));

export default function Page(props: SimplePageProps) {
  return <LegalPage {...props} segmentLocale={SEGMENT_LOCALE} document="terms" />;
}
