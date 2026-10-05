import { countSitemapChunks, renderSitemapIndex } from '@/features/seo/sitemap';
import { absolute } from '@/lib/seo/metadata';

export const revalidate = 3600;

/** The index every crawler looks for; it points at the numbered chunks. */
export async function GET() {
  const chunks = await countSitemapChunks();
  const urls = Array.from({ length: chunks }, (_, index) => absolute(`/sitemaps/${index}.xml`));

  return new Response(renderSitemapIndex(urls, new Date()), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
