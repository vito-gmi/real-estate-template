import type { Locale } from '@/i18n/routing';
import type { CoverImage, MediaVariant } from '@/lib/domain/media';
import type {
  ListingCardDto,
  ListingDetailDto,
  ListingFeatureDto,
  ListingPhotoDto,
  ListingPrice,
  PlaceRef,
} from './dto';

/**
 * Row → DTO mapping.
 *
 * The two rules enforced here are worth stating plainly, because they are
 * security boundaries rather than formatting choices:
 *
 * 1. When `hideExactAddress` is set, the street address is dropped and the map
 *    pin is rounded to roughly a 300 m grid. Returning the precise value and
 *    "not rendering it" would still ship it inside the RSC payload.
 * 2. Only the fields declared on the DTO survive; anything else in the row —
 *    internal notes, author ids — is left behind by construction.
 * 3. When `showPrice` is off, the whole price is dropped, per-m² figure
 *    included, even though the row still carries the stored amount.
 */

/** ~0.003° ≈ 300 m in Bulgaria; enough to show the neighbourhood, not the door. */
const COORDINATE_GRID = 0.003;

function fuzz(value: number): number {
  return Math.round(value / COORDINATE_GRID) * COORDINATE_GRID;
}

export type LocationNames = {
  readonly nameBg: string;
  readonly nameEn: string;
  readonly slugBg: string;
  readonly slugEn: string;
};

export function toPlaceRef(locale: Locale, location: LocationNames | null): PlaceRef | null {
  if (!location) return null;
  return {
    name: locale === 'bg' ? location.nameBg : location.nameEn,
    slug: locale === 'bg' ? location.slugBg : location.slugEn,
  };
}

export type ListingCardRow = {
  id: string;
  reference: number;
  dealType: ListingCardDto['dealType'];
  propertyKind: ListingCardDto['kind'];
  status: ListingCardDto['status'];
  price: number | null;
  currency: ListingPrice['currency'];
  showPrice: boolean;
  priceEur: number | null;
  pricePerSqmEur: number | null;
  area: number | null;
  landArea: number | null;
  rooms: number | null;
  bedrooms: number | null;
  floor: number | null;
  floorsTotal: number | null;
  coverImage: CoverImage | null;
  isFeatured: boolean;
  isExclusive: boolean;
  publishedAt: Date | null;
  title: string;
  slug: string;
  city: LocationNames | null;
  district: LocationNames | null;
};

function toPrice(row: ListingCardRow): ListingPrice | null {
  if (!row.showPrice || row.price === null) return null;
  return {
    amount: row.price,
    currency: row.currency,
    eur: row.priceEur ?? row.price,
    perSqmEur: row.pricePerSqmEur,
  };
}

export function toListingCard(locale: Locale, row: ListingCardRow): ListingCardDto {
  return {
    id: row.id,
    reference: row.reference,
    slug: row.slug,
    title: row.title,
    dealType: row.dealType,
    kind: row.propertyKind,
    status: row.status,
    price: toPrice(row),
    area: row.area,
    landArea: row.landArea,
    rooms: row.rooms,
    bedrooms: row.bedrooms,
    floor: row.floor,
    floorsTotal: row.floorsTotal,
    city: toPlaceRef(locale, row.city),
    district: toPlaceRef(locale, row.district),
    cover: row.coverImage,
    isFeatured: row.isFeatured,
    isExclusive: row.isExclusive,
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

export type ListingDetailRow = ListingCardRow & {
  description: string;
  metaTitle: string | null;
  metaDescription: string | null;
  bathrooms: number | null;
  yearBuilt: number | null;
  constructionType: ListingDetailDto['constructionType'];
  heating: ListingDetailDto['heating'];
  furnishing: ListingDetailDto['furnishing'];
  condition: ListingDetailDto['condition'];
  energyLabel: string | null;
  maintenanceFee: number | null;
  depositMonths: number | null;
  availableFrom: string | null;
  videoUrl: string | null;
  updatedAt: Date;
  address: string | null;
  hideExactAddress: boolean;
  lat: number | null;
  lng: number | null;
};

export type MediaRowForDto = {
  id: string;
  kind: 'photo' | 'floor_plan' | 'document';
  width: number;
  height: number;
  blurDataUrl: string | null;
  altBg: string | null;
  altEn: string | null;
  variants: MediaVariant[];
};

export type FeatureRowForDto = {
  key: string;
  category: string;
  icon: string | null;
  nameBg: string;
  nameEn: string;
};

function toPhoto(locale: Locale, row: MediaRowForDto, fallbackAlt: string): ListingPhotoDto {
  return {
    id: row.id,
    width: row.width,
    height: row.height,
    blurDataUrl: row.blurDataUrl,
    alt: (locale === 'bg' ? row.altBg : row.altEn) ?? fallbackAlt,
    variants: row.variants,
  };
}

export function toListingDetail(
  locale: Locale,
  row: ListingDetailRow,
  mediaRows: readonly MediaRowForDto[],
  featureRows: readonly FeatureRowForDto[],
): ListingDetailDto {
  const card = toListingCard(locale, row);
  const hasCoordinates = row.lat !== null && row.lng !== null;

  const features: ListingFeatureDto[] = featureRows.map((feature) => ({
    key: feature.key,
    name: locale === 'bg' ? feature.nameBg : feature.nameEn,
    category: feature.category,
    icon: feature.icon,
  }));

  return {
    ...card,
    description: row.description,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    bathrooms: row.bathrooms,
    yearBuilt: row.yearBuilt,
    constructionType: row.constructionType,
    heating: row.heating,
    furnishing: row.furnishing,
    condition: row.condition,
    energyLabel: row.energyLabel,
    maintenanceFee: row.maintenanceFee,
    depositMonths: row.depositMonths,
    availableFrom: row.availableFrom,
    videoUrl: row.videoUrl,
    updatedAt: row.updatedAt.toISOString(),
    address: row.hideExactAddress ? null : row.address,
    map: hasCoordinates
      ? {
          lat: row.hideExactAddress ? fuzz(row.lat!) : row.lat!,
          lng: row.hideExactAddress ? fuzz(row.lng!) : row.lng!,
          approximate: row.hideExactAddress,
        }
      : null,
    photos: mediaRows
      .filter((item) => item.kind === 'photo')
      .map((item) => toPhoto(locale, item, card.title)),
    floorPlans: mediaRows
      .filter((item) => item.kind === 'floor_plan')
      .map((item) => toPhoto(locale, item, card.title)),
    features,
  };
}
