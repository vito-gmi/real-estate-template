import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  renderListingOgImage,
} from '@/features/listings/og-image';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Property';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderListingOgImage('bg', slug);
}
