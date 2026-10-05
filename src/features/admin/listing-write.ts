import type { Locale } from '@/i18n/routing';
import { slugify } from '@/lib/utils';
import type { ListingFormValues } from './listing-schema';

/**
 * Shared listing write helpers.
 *
 * Kept out of the `'use server'` module so they can be imported by import/export
 * without accidentally becoming public server actions.
 */

export function translationPairs(values: ListingFormValues) {
  return [
    {
      locale: 'bg' as Locale,
      title: values.titleBg,
      description: values.descriptionBg,
      slug: values.slugBg,
      metaTitle: values.metaTitleBg,
      metaDescription: values.metaDescriptionBg,
    },
    {
      locale: 'en' as Locale,
      title: values.titleEn,
      description: values.descriptionEn,
      slug: values.slugEn,
      metaTitle: values.metaTitleEn,
      metaDescription: values.metaDescriptionEn,
    },
  ];
}

/**
 * Slugs must be unique per locale and stable once published, so the reference
 * number is appended: two "Two-bedroom apartment in Lozenets" listings can
 * coexist without one silently overwriting the other's URL.
 */
export function buildSlug(explicit: string | undefined, title: string, reference: number): string {
  const base = explicit ? slugify(explicit) : slugify(title);
  return base.endsWith(String(reference)) ? base : `${base}-${reference}`;
}

export function listingColumns(
  values: ListingFormValues,
  ancestry: { cityId: string | null; regionId: string | null },
) {
  return {
    dealType: values.dealType,
    propertyKind: values.propertyKind,
    status: values.status,
    price: values.price,
    currency: values.currency,
    area: values.area ?? null,
    landArea: values.landArea ?? null,
    rooms: values.rooms ?? null,
    bedrooms: values.bedrooms ?? null,
    bathrooms: values.bathrooms ?? null,
    floor: values.floor ?? null,
    floorsTotal: values.floorsTotal ?? null,
    yearBuilt: values.yearBuilt ?? null,
    constructionType: values.constructionType ?? null,
    heating: values.heating ?? null,
    furnishing: values.furnishing ?? null,
    condition: values.condition ?? null,
    energyLabel: values.energyLabel ?? null,
    maintenanceFee: values.maintenanceFee ?? null,
    depositMonths: values.depositMonths ?? null,
    availableFrom: values.availableFrom ?? null,
    locationId: values.locationId,
    cityId: ancestry.cityId,
    regionId: ancestry.regionId,
    address: values.address ?? null,
    hideExactAddress: values.hideExactAddress,
    lat: values.lat ?? null,
    lng: values.lng ?? null,
    videoUrl: values.videoUrl || null,
    isFeatured: values.isFeatured,
    isExclusive: values.isExclusive,
    updatedAt: new Date(),
  };
}
