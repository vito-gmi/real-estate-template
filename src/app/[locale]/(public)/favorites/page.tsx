import { FavoritesPage, personalPageMetadata } from '@/features/pages/personal-pages';
import type { SimplePageProps } from '@/features/pages/simple-page';

const SEGMENT_LOCALE = 'en' as const;

export const generateMetadata = personalPageMetadata('favorites', SEGMENT_LOCALE);

export default function Page(props: SimplePageProps) {
  return <FavoritesPage {...props} segmentLocale={SEGMENT_LOCALE} />;
}
