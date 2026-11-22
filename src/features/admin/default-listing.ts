import type { ListingFormInput } from './listing-schema';
import type { AdminListingDetail } from '@/server/repositories/admin-listings';

/** A blank listing, shaped so every control starts controlled rather than undefined. */
export function emptyListingForm(locationId: string): ListingFormInput {
  return {
    dealType: 'sale',
    propertyKind: 'apartment',
    status: 'draft',
    currency: 'EUR',
    showPrice: false,
    locationId,
    hideExactAddress: true,
    isFeatured: false,
    isExclusive: false,
    titleBg: '',
    titleEn: '',
    descriptionBg: '',
    descriptionEn: '',
    featureKeys: [],
  };
}

/** Maps a stored listing back into the form's shape. */
export function listingToForm(detail: AdminListingDetail): ListingFormInput {
  const { listing, translations, featureKeys } = detail;

  return {
    dealType: listing.dealType,
    propertyKind: listing.propertyKind,
    status: listing.status,
    price: listing.price ?? undefined,
    currency: listing.currency,
    showPrice: listing.showPrice,
    area: listing.area ?? undefined,
    landArea: listing.landArea ?? undefined,
    rooms: listing.rooms ?? undefined,
    bedrooms: listing.bedrooms ?? undefined,
    bathrooms: listing.bathrooms ?? undefined,
    floor: listing.floor ?? undefined,
    floorsTotal: listing.floorsTotal ?? undefined,
    yearBuilt: listing.yearBuilt ?? undefined,
    constructionType: listing.constructionType ?? undefined,
    heating: listing.heating ?? undefined,
    furnishing: listing.furnishing ?? undefined,
    condition: listing.condition ?? undefined,
    energyLabel: listing.energyLabel ?? undefined,
    maintenanceFee: listing.maintenanceFee ?? undefined,
    depositMonths: listing.depositMonths ?? undefined,
    availableFrom: listing.availableFrom ?? undefined,
    locationId: listing.locationId,
    address: listing.address ?? undefined,
    hideExactAddress: listing.hideExactAddress,
    lat: listing.lat ?? undefined,
    lng: listing.lng ?? undefined,
    videoUrl: listing.videoUrl ?? undefined,
    isFeatured: listing.isFeatured,
    isExclusive: listing.isExclusive,
    titleBg: translations.bg?.title ?? '',
    titleEn: translations.en?.title ?? '',
    descriptionBg: translations.bg?.description ?? '',
    descriptionEn: translations.en?.description ?? '',
    slugBg: translations.bg?.slug ?? undefined,
    slugEn: translations.en?.slug ?? undefined,
    metaTitleBg: translations.bg?.metaTitle ?? undefined,
    metaTitleEn: translations.en?.metaTitle ?? undefined,
    metaDescriptionBg: translations.bg?.metaDescription ?? undefined,
    metaDescriptionEn: translations.en?.metaDescription ?? undefined,
    featureKeys,
  };
}
