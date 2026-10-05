import { ImageResponse } from 'next/og';
import { siteConfig } from '@/config/site';
import { getListingBySlug } from '@/features/listings/queries';
import type { Locale } from '@/i18n/routing';
import { formatArea, formatPrice } from '@/lib/format';
import { fallbackSrc } from '@/lib/media-url';
import { absolute } from '@/lib/seo/metadata';

/**
 * Social preview card for a listing.
 *
 * Generated at the edge and then cached alongside the page, so the cost is paid
 * once per listing rather than once per share. The layout is deliberately plain:
 * `next/og` supports a small subset of CSS, and a card that renders reliably
 * everywhere beats one that renders beautifully in one place and breaks in the
 * next.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

export async function renderListingOgImage(locale: Locale, slug: string) {
  const result = await getListingBySlug(locale, slug);

  if (!result) {
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1b2430',
            color: 'white',
            fontSize: 64,
            fontWeight: 600,
          }}
        >
          {siteConfig.name}
        </div>
      ),
      OG_SIZE,
    );
  }

  const { listing } = result;
  const cover = listing.cover ? fallbackSrc(listing.cover.variants) : null;
  const coverUrl = cover?.startsWith('http') ? cover : cover ? absolute(cover) : null;
  const place = [listing.city?.name, listing.district?.name].filter(Boolean).join(', ');
  const area = listing.area ?? listing.landArea;

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: '#101720' }}>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            width={620}
            height={630}
            style={{ width: 620, height: 630, objectFit: 'cover' }}
          />
        ) : null}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 56,
            flex: 1,
            color: '#f4f6f9',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', fontSize: 26, color: '#9fb0c6', letterSpacing: 1 }}>
              {siteConfig.name.toUpperCase()}
            </div>
            <div style={{ display: 'flex', fontSize: 46, fontWeight: 700, lineHeight: 1.15 }}>
              {listing.title.slice(0, 90)}
            </div>
            {place ? (
              <div style={{ display: 'flex', fontSize: 28, color: '#9fb0c6' }}>{place}</div>
            ) : null}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', fontSize: 58, fontWeight: 700, color: '#e9b872' }}>
              {formatPrice(locale, listing.price.amount, listing.price.currency)}
            </div>
            <div style={{ display: 'flex', gap: 28, fontSize: 26, color: '#9fb0c6' }}>
              {area ? <span>{formatArea(locale, area)}</span> : null}
              {listing.rooms ? <span>{listing.rooms} · rooms</span> : null}
              <span>ID {listing.reference}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
