import { siteConfig } from '@/config/site';
import type { ListingDetailDto } from '@/features/listings/dto';
import type { Locale } from '@/i18n/routing';
import { hasIndoorArea } from '@/lib/domain/enums';
import { fallbackSrc } from '@/lib/media-url';
import { absolute } from './metadata';

/**
 * Structured data.
 *
 * A `<script type="application/ld+json">` is a data block, not executable code,
 * so it is exempt from `script-src` and works under the strict CSP the public
 * pages ship with.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // The payload is built from typed values, never from raw user input, and
      // `<` is escaped so a description can never close the script element.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replaceAll('<', '\\u003c') }}
    />
  );
}

export function organizationJsonLd(locale: Locale): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: siteConfig.legalName,
    url: siteConfig.url,
    // Search engines may show this logo next to the business in results.
    ...(siteConfig.logo ? { logo: absolute(siteConfig.logo.src) } : {}),
    telephone: siteConfig.contact.phone,
    email: siteConfig.contact.email,
    sameAs: siteConfig.social.map((social) => social.href),
    address: siteConfig.offices.map((office) => ({
      '@type': 'PostalAddress',
      streetAddress: office.address[locale],
      addressLocality: office.city[locale],
      addressCountry: 'BG',
    })),
  };
}

export function breadcrumbJsonLd(
  crumbs: readonly { name: string; href: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      ...(crumb.href ? { item: absolute(crumb.href) } : {}),
    })),
  };
}

/**
 * A listing is modelled as `RealEstateListing` carrying an `Offer`, which is
 * what Google's property-listing documentation expects and what surfaces price
 * and availability in results.
 */
export function listingJsonLd(
  listing: ListingDetailDto,
  canonicalUrl: string,
): Record<string, unknown> {
  const images = listing.photos
    .map((photo) => fallbackSrc(photo.variants))
    .filter((src): src is string => Boolean(src));

  const availability =
    listing.status === 'reserved'
      ? 'https://schema.org/LimitedAvailability'
      : 'https://schema.org/InStock';

  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: listing.title,
    description: listing.description,
    url: canonicalUrl,
    datePosted: listing.publishedAt,
    identifier: String(listing.reference),
    ...(images.length > 0 ? { image: images.slice(0, 8) } : {}),
    offers: {
      '@type': 'Offer',
      price: listing.price.amount,
      priceCurrency: listing.price.currency,
      availability,
      businessFunction:
        listing.dealType === 'sale'
          ? 'https://schema.org/Sell'
          : 'https://schema.org/LeaseOut',
      seller: { '@type': 'RealEstateAgent', name: siteConfig.legalName, url: siteConfig.url },
    },
    about: {
      '@type': listing.kind === 'apartment' ? 'Apartment' : 'Accommodation',
      ...(listing.rooms ? { numberOfRooms: listing.rooms } : {}),
      ...(listing.bedrooms ? { numberOfBedrooms: listing.bedrooms } : {}),
      ...(listing.bathrooms ? { numberOfBathroomsTotal: listing.bathrooms } : {}),
      ...(listing.area && hasIndoorArea(listing.kind)
        ? { floorSize: { '@type': 'QuantitativeValue', value: listing.area, unitCode: 'MTK' } }
        : {}),
      ...(listing.features.length > 0
        ? {
            amenityFeature: listing.features.map((feature) => ({
              '@type': 'LocationFeatureSpecification',
              name: feature.name,
              value: true,
            })),
          }
        : {}),
      address: {
        '@type': 'PostalAddress',
        addressLocality: listing.city?.name,
        addressRegion: listing.district?.name,
        addressCountry: 'BG',
        ...(listing.address ? { streetAddress: listing.address } : {}),
      },
      ...(listing.map
        ? {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: listing.map.lat,
              longitude: listing.map.lng,
            },
          }
        : {}),
    },
  };
}
