import { notFound } from 'next/navigation';
import {
  countSitemapChunks,
  listingEntries,
  renderUrlSet,
  staticEntries,
} from '@/features/seo/sitemap';

export const revalidate = 3600;

export async function GET(_request: Request, { params }: { params: Promise<{ chunk: string }> }) {
  const { chunk } = await params;
  const index = Number.parseInt(chunk.replace(/\.xml$/, ''), 10);

  if (!Number.isInteger(index) || index < 0 || index >= (await countSitemapChunks())) {
    notFound();
  }

  const entries = index === 0 ? staticEntries() : await listingEntries(index - 1);

  return new Response(renderUrlSet(entries), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
