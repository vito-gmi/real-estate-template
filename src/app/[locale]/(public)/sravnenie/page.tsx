import { ComparePage, personalPageMetadata } from '@/features/pages/personal-pages';
import type { SimplePageProps } from '@/features/pages/simple-page';

const SEGMENT_LOCALE = 'bg' as const;

export const generateMetadata = personalPageMetadata('compare', SEGMENT_LOCALE);

export default function Page(props: SimplePageProps) {
  return <ComparePage {...props} segmentLocale={SEGMENT_LOCALE} />;
}
