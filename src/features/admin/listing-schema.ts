import { z } from 'zod';
import {
  conditions,
  constructionTypes,
  currencies,
  dealTypes,
  furnishingTypes,
  heatingTypes,
  listingStatuses,
  propertyKinds,
} from '@/lib/domain/enums';
import { optionalNumber, optionalText } from '@/lib/form-fields';

/**
 * The listing form contract.
 *
 * One schema drives the React Hook Form resolver, the server action's
 * validation and the TypeScript types on both sides. A field cannot exist in the
 * form without existing here, which is what keeps client and server honest about
 * what a valid listing is.
 */

export const listingFormSchema = z
  .object({
    dealType: z.enum(dealTypes),
    propertyKind: z.enum(propertyKinds),
    status: z.enum(listingStatuses).default('draft'),

    // Optional, and hidden unless `showPrice` is on. Hiding keeps the amount so
    // turning the price back on restores it.
    price: optionalNumber,
    currency: z.enum(currencies).default('EUR'),
    showPrice: z.boolean().default(false),

    area: optionalNumber,
    landArea: optionalNumber,
    rooms: optionalNumber,
    bedrooms: optionalNumber,
    bathrooms: optionalNumber,
    floor: optionalNumber,
    floorsTotal: optionalNumber,
    yearBuilt: optionalNumber,

    constructionType: z.enum(constructionTypes).optional(),
    heating: z.enum(heatingTypes).optional(),
    furnishing: z.enum(furnishingTypes).optional(),
    condition: z.enum(conditions).optional(),
    energyLabel: optionalText,

    maintenanceFee: optionalNumber,
    depositMonths: optionalNumber,
    availableFrom: optionalText,

    locationId: z.uuid('admin.errors.location'),
    address: optionalText,
    hideExactAddress: z.boolean().default(true),
    lat: optionalNumber,
    lng: optionalNumber,

    videoUrl: z.union([z.url(), z.literal('')]).optional(),
    isFeatured: z.boolean().default(false),
    isExclusive: z.boolean().default(false),

    titleBg: z.string().trim().min(5, 'admin.errors.title').max(180),
    titleEn: z.string().trim().min(5, 'admin.errors.title').max(180),
    descriptionBg: z.string().trim().max(8000).default(''),
    descriptionEn: z.string().trim().max(8000).default(''),
    slugBg: optionalText,
    slugEn: optionalText,
    metaTitleBg: optionalText,
    metaTitleEn: optionalText,
    metaDescriptionBg: optionalText,
    metaDescriptionEn: optionalText,

    featureKeys: z.array(z.string()).default([]),
  })
  .refine(
    (value) => (value.price === undefined ? !value.showPrice : value.price > 0),
    { message: 'admin.errors.price', path: ['price'] },
  )
  .refine((value) => value.floor === undefined || value.floorsTotal === undefined || value.floor <= value.floorsTotal, {
    message: 'admin.errors.floorAboveTotal',
    path: ['floor'],
  })
  .refine(
    (value) =>
      // Publishing without a photo produces a card with an empty grey box, which
      // looks broken; drafts may be incomplete.
      value.status === 'draft' || value.titleBg.length > 0,
    { message: 'admin.errors.title', path: ['titleBg'] },
  );

export type ListingFormInput = z.input<typeof listingFormSchema>;
export type ListingFormValues = z.output<typeof listingFormSchema>;

export const listingIdSchema = z.object({ id: z.uuid() });

export const statusChangeSchema = z.object({
  id: z.uuid(),
  status: z.enum(listingStatuses),
});
