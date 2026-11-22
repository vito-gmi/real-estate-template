import { z } from 'zod';
import { locales } from '@/i18n/routing';
import {
  conditions,
  constructionTypes,
  currencies,
  dealTypes,
  furnishingTypes,
  heatingTypes,
  propertyKinds,
  reviewableSubmissionStatuses,
  submitterRoles,
} from '@/lib/domain/enums';
import { MAX_SUBMISSION_PHOTOS } from '@/lib/domain/media';
import { boundedNumber, optionalTextMax, optionalUuid } from '@/lib/form-fields';

/**
 * The "list your property" contract.
 *
 * One schema types the public form, validates the server action and produces
 * the error keys the form translates. Messages are keys in the `submit`
 * namespace (`submit.errors.*`).
 *
 * Bounds are generous but finite: they stop typos (a 2,000,000 m² flat) and
 * keep every value inside its Postgres column, without second-guessing unusual
 * but real properties.
 */

const NUMBER = 'submit.errors.number';
const LATEST_YEAR = new Date().getFullYear() + 5;

export const submissionSchema = z
  .object({
    /** Handle on the `incomplete` row created when the first photo was added. */
    token: z.string().max(512).optional(),

    dealType: z.enum(dealTypes),
    propertyKind: z.enum(propertyKinds),

    cityId: optionalUuid,
    districtId: optionalUuid,
    locationText: optionalTextMax(200),
    address: optionalTextMax(200),

    price: boundedNumber(1, 1_000_000_000, { message: NUMBER }),
    currency: z.enum(currencies).default('EUR'),

    area: boundedNumber(1, 1_000_000, { message: NUMBER }),
    landArea: boundedNumber(1, 100_000_000, { message: NUMBER }),
    rooms: boundedNumber(0, 100, { integer: true, message: NUMBER }),
    bedrooms: boundedNumber(0, 100, { integer: true, message: NUMBER }),
    bathrooms: boundedNumber(0, 50, { integer: true, message: NUMBER }),
    floor: boundedNumber(-5, 300, { integer: true, message: NUMBER }),
    floorsTotal: boundedNumber(1, 300, { integer: true, message: NUMBER }),
    yearBuilt: boundedNumber(1800, LATEST_YEAR, { integer: true, message: NUMBER }),
    constructionType: z.enum(constructionTypes).optional(),
    heating: z.enum(heatingTypes).optional(),
    furnishing: z.enum(furnishingTypes).optional(),
    condition: z.enum(conditions).optional(),
    featureKeys: z.array(z.string().max(60)).max(60).default([]),

    maintenanceFee: boundedNumber(0, 1_000_000, { message: NUMBER }),
    depositMonths: boundedNumber(0, 24, { integer: true, message: NUMBER }),
    availableFrom: z
      .union([z.iso.date('submit.errors.date'), z.literal('')])
      .optional()
      .transform((value) => (value ? value : undefined)),

    description: z.string().trim().min(30, 'submit.errors.description').max(4000),
    externalMediaUrl: z
      .union([z.url({ protocol: /^https?$/, error: 'submit.errors.url' }), z.literal('')])
      .optional()
      .transform((value) => (value ? value : undefined)),

    firstName: z.string().trim().min(2, 'submit.errors.firstName').max(80),
    lastName: z.string().trim().min(2, 'submit.errors.lastName').max(80),
    email: z.email('submit.errors.email').max(160),
    phone: z
      .string()
      .trim()
      .max(40)
      .regex(/^[\d\s+()./-]{6,}$/, 'submit.errors.phone'),
    submitterRole: z.enum(submitterRoles).default('owner'),
    contactTime: optionalTextMax(120),
    locale: z.enum(locales).default('bg'),

    consent: z.literal(true, 'submit.errors.consent'),
    /** Honeypot: hidden from people, filled in by naive bots. */
    website: z.string().max(0).optional(),
    turnstileToken: z.string().max(4096).optional(),

    /** Uploaded photos in the visitor's chosen order; the first is the cover. */
    photoIds: z.array(z.uuid()).max(MAX_SUBMISSION_PHOTOS).default([]),
  })
  // Cross-field rules. Zod skips refinements while any field has an error;
  // `when` runs them anyway (as long as their own inputs are valid), so a
  // visitor sees every problem on the first submit rather than one at a time.
  .refine((value) => Boolean(value.cityId || value.locationText), {
    message: 'submit.errors.location',
    path: ['cityId'],
    when: (payload) => !hasIssueAt(payload.issues, ['cityId', 'locationText']),
  })
  .refine(
    (value) =>
      value.floor === undefined || value.floorsTotal === undefined || value.floor <= value.floorsTotal,
    {
      message: 'submit.errors.floorAboveTotal',
      path: ['floor'],
      when: (payload) => !hasIssueAt(payload.issues, ['floor', 'floorsTotal']),
    },
  );

function hasIssueAt(issues: readonly { path?: readonly PropertyKey[] }[], fields: readonly string[]) {
  return issues.some((issue) => fields.includes(String(issue.path?.[0])));
}

export type SubmissionInput = z.input<typeof submissionSchema>;
export type SubmissionValues = z.output<typeof submissionSchema>;

/** Starting a submission happens when the first photo is added. */
export const startSubmissionSchema = z.object({ locale: z.enum(locales).default('bg') });

export const submissionTokenSchema = z.object({ token: z.string().min(1).max(512) });

// --- Admin -------------------------------------------------------------------

export const approveSubmissionSchema = z.object({
  id: z.uuid(),
  /**
   * The district the listing is filed under (listings need a taxonomy place).
   * Not needed to resume copying photos of an already approved submission.
   */
  locationId: z.uuid('admin.errors.location').optional(),
  /** Photos to copy into the listing, in order. */
  photoIds: z.array(z.uuid()).max(MAX_SUBMISSION_PHOTOS),
  notify: z.boolean(),
});

export const rejectSubmissionSchema = z.object({
  id: z.uuid(),
  reason: optionalTextMax(1000),
  notify: z.boolean(),
});

export const submissionIdSchema = z.object({ id: z.uuid() });

export const submissionNoteSchema = z.object({
  id: z.uuid(),
  note: z.string().trim().max(4000),
});

export const importSubmissionPhotoSchema = z.object({
  submissionId: z.uuid(),
  photoId: z.uuid(),
});

export const submissionStatusFilter = z.enum(reviewableSubmissionStatuses);
