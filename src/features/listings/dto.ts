import type {
  Condition,
  ConstructionType,
  Currency,
  DealType,
  FurnishingType,
  HeatingType,
  ListingStatus,
  PropertyKind,
} from '@/lib/domain/enums';
import type { CoverImage, MediaVariant } from '@/lib/domain/media';

/**
 * View models.
 *
 * Database rows never reach a component. Mapping through these types is what
 * guarantees that a hidden street address, an internal note or a `createdBy`
 * user id cannot accidentally be serialised into the HTML payload.
 */

export type PlaceRef = {
  readonly name: string;
  readonly slug: string;
};

export type ListingPrice = {
  readonly amount: number;
  readonly currency: Currency;
  readonly eur: number;
  readonly perSqmEur: number | null;
};

export type ListingCardDto = {
  readonly id: string;
  readonly reference: number;
  readonly slug: string;
  readonly title: string;
  readonly dealType: DealType;
  readonly kind: PropertyKind;
  readonly status: ListingStatus;
  readonly price: ListingPrice;
  readonly area: number | null;
  readonly landArea: number | null;
  readonly rooms: number | null;
  readonly bedrooms: number | null;
  readonly floor: number | null;
  readonly floorsTotal: number | null;
  readonly city: PlaceRef | null;
  readonly district: PlaceRef | null;
  readonly cover: CoverImage | null;
  readonly isFeatured: boolean;
  readonly isExclusive: boolean;
  readonly publishedAt: string | null;
};

export type ListingPhotoDto = {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly blurDataUrl: string | null;
  readonly alt: string;
  readonly variants: readonly MediaVariant[];
};

export type ListingFeatureDto = {
  readonly key: string;
  readonly name: string;
  readonly category: string;
  readonly icon: string | null;
};

export type ListingDetailDto = ListingCardDto & {
  readonly description: string;
  readonly metaTitle: string | null;
  readonly metaDescription: string | null;
  readonly bathrooms: number | null;
  readonly yearBuilt: number | null;
  readonly constructionType: ConstructionType | null;
  readonly heating: HeatingType | null;
  readonly furnishing: FurnishingType | null;
  readonly condition: Condition | null;
  readonly energyLabel: string | null;
  readonly maintenanceFee: number | null;
  readonly depositMonths: number | null;
  readonly availableFrom: string | null;
  readonly videoUrl: string | null;
  readonly updatedAt: string;
  /** Absent entirely when the agency chose to hide the address. */
  readonly address: string | null;
  readonly map: { readonly lat: number; readonly lng: number; readonly approximate: boolean } | null;
  readonly photos: readonly ListingPhotoDto[];
  readonly floorPlans: readonly ListingPhotoDto[];
  readonly features: readonly ListingFeatureDto[];
};
