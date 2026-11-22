import type { ListingFormInput } from '@/features/admin/listing-schema';
import type { PropertySubmissionRow } from '@/server/db/schema';

/**
 * Turning an approved submission into a draft listing.
 *
 * Pure, so it can be tested without a database. The result goes through the
 * same `listingFormSchema` the admin form uses, so a listing created from a
 * submission is held to exactly the rules of one typed in by an agent.
 *
 * Choices made on the agent's behalf, all easy to change in the editor:
 * - the listing starts as a draft — approving is not publishing;
 * - the asking price is kept but hidden ("price on request");
 * - the exact address is hidden;
 * - the description goes into the language the owner wrote in, the other
 *   language is left for the agent to translate.
 */

export type ListingTitleParts = {
  readonly kindBg: string;
  readonly kindEn: string;
  /** Most specific place first, e.g. ["Lozenets", "Sofia"]. */
  readonly placeBg: readonly (string | null | undefined)[];
  readonly placeEn: readonly (string | null | undefined)[];
};

/** "Apartment, Lozenets, Sofia" — a starting point the agent rewrites. */
export function submissionTitles(parts: ListingTitleParts): { titleBg: string; titleEn: string } {
  const join = (kind: string, place: readonly (string | null | undefined)[]) =>
    [kind, ...place].filter((part): part is string => Boolean(part && part.trim())).join(', ');

  return {
    titleBg: join(parts.kindBg, parts.placeBg),
    titleEn: join(parts.kindEn, parts.placeEn),
  };
}

export function submissionToListingInput(
  submission: PropertySubmissionRow,
  options: { locationId: string; titleBg: string; titleEn: string },
): ListingFormInput {
  if (!submission.dealType || !submission.propertyKind) {
    throw new Error('A submission without a deal type and property kind cannot become a listing.');
  }

  return {
    dealType: submission.dealType,
    propertyKind: submission.propertyKind,
    status: 'draft',

    price: submission.price ?? undefined,
    currency: submission.currency,
    showPrice: false,

    area: submission.area ?? undefined,
    landArea: submission.landArea ?? undefined,
    rooms: submission.rooms ?? undefined,
    bedrooms: submission.bedrooms ?? undefined,
    bathrooms: submission.bathrooms ?? undefined,
    floor: submission.floor ?? undefined,
    floorsTotal: submission.floorsTotal ?? undefined,
    yearBuilt: submission.yearBuilt ?? undefined,
    constructionType: submission.constructionType ?? undefined,
    heating: submission.heating ?? undefined,
    furnishing: submission.furnishing ?? undefined,
    condition: submission.condition ?? undefined,

    maintenanceFee: submission.maintenanceFee ?? undefined,
    depositMonths: submission.depositMonths ?? undefined,
    availableFrom: submission.availableFrom ?? undefined,

    locationId: options.locationId,
    address: submission.address ?? undefined,
    hideExactAddress: true,

    isFeatured: false,
    isExclusive: false,

    titleBg: options.titleBg,
    titleEn: options.titleEn,
    descriptionBg: submission.locale === 'bg' ? submission.description : '',
    descriptionEn: submission.locale === 'en' ? submission.description : '',

    featureKeys: [...submission.featureKeys],
  };
}
