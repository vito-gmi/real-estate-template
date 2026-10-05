import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';
import { absolute } from '@/lib/seo/metadata';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          // Personal, device-local pages: nothing for a crawler to index, and a
          // shared shortlist should never appear in search results.
          '/*/favoriti',
          '/*/favorites',
          '/*/sravnenie',
          '/*/compare',
          '/*/admin',
          // Query-string refinements multiply combinatorially. The crawlable
          // surface is the clean path hierarchy; everything else is noise that
          // would consume crawl budget better spent on listing pages.
          '/*?*cursor=',
          '/*?*p=',
          '/*?*sort=',
        ],
      },
    ],
    sitemap: absolute('/sitemap.xml'),
    host: siteConfig.url,
  };
}
