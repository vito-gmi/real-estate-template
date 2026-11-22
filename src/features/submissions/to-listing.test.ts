import { describe, expect, it } from 'vitest';
import { listingFormSchema } from '@/features/admin/listing-schema';
import type { PropertySubmissionRow } from '@/server/db/schema';
import { submissionTitles, submissionToListingInput } from './to-listing';

const DISTRICT = '7a0c3e3a-7d0f-4d6e-9a43-2b5f1c9e8d11';

function submission(overrides: Partial<PropertySubmissionRow> = {}): PropertySubmissionRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    reference: 1042,
    status: 'pending',
    dealType: 'rent',
    propertyKind: 'apartment',
    locationId: DISTRICT,
    locationText: null,
    address: 'ul. Example 12',
    price: 950,
    currency: 'EUR',
    area: 82,
    landArea: null,
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    floor: 5,
    floorsTotal: 8,
    yearBuilt: 2015,
    constructionType: 'brick',
    heating: 'central',
    furnishing: 'furnished',
    condition: 'good',
    featureKeys: ['elevator', 'parking'],
    maintenanceFee: 40,
    depositMonths: 2,
    availableFrom: '2027-01-01',
    description: 'Светъл тристаен апартамент близо до метро, обзаведен.',
    externalMediaUrl: null,
    locale: 'bg',
    firstName: 'Мария',
    lastName: 'Петрова',
    email: 'maria@example.com',
    phone: '+359 88 123 4567',
    submitterRole: 'owner',
    contactTime: null,
    consentAt: new Date(),
    ipHash: null,
    userAgent: null,
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    internalNote: null,
    listingId: null,
    submittedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('submissionTitles', () => {
  it('joins kind and place, skipping blanks', () => {
    expect(
      submissionTitles({
        kindBg: 'Апартамент',
        kindEn: 'Apartment',
        placeBg: ['Лозенец', 'София'],
        placeEn: ['Lozenets', null],
      }),
    ).toEqual({ titleBg: 'Апартамент, Лозенец, София', titleEn: 'Apartment, Lozenets' });
  });
});

describe('submissionToListingInput', () => {
  const titles = { titleBg: 'Апартамент, Лозенец, София', titleEn: 'Apartment, Lozenets, Sofia' };

  it('produces a draft the admin listing schema accepts', () => {
    const parsed = listingFormSchema.safeParse(
      submissionToListingInput(submission(), { locationId: DISTRICT, ...titles }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.status).toBe('draft');
    expect(parsed.data.locationId).toBe(DISTRICT);
    expect(parsed.data.featureKeys).toEqual(['elevator', 'parking']);
    expect(parsed.data.maintenanceFee).toBe(40);
    expect(parsed.data.availableFrom).toBe('2027-01-01');
  });

  it('keeps the asking price but publishes it as "price on request"', () => {
    const input = submissionToListingInput(submission(), { locationId: DISTRICT, ...titles });
    expect(input.price).toBe(950);
    expect(input.showPrice).toBe(false);
    expect(input.hideExactAddress).toBe(true);
    expect(input.isFeatured).toBe(false);
  });

  it('puts the description in the language the owner wrote in', () => {
    const bg = submissionToListingInput(submission(), { locationId: DISTRICT, ...titles });
    expect(bg.descriptionBg).toContain('тристаен');
    expect(bg.descriptionEn).toBe('');

    const en = submissionToListingInput(
      submission({ locale: 'en', description: 'Bright flat near the metro.' }),
      { locationId: DISTRICT, ...titles },
    );
    expect(en.descriptionEn).toBe('Bright flat near the metro.');
    expect(en.descriptionBg).toBe('');
  });

  it('refuses a submission that never said what it is', () => {
    expect(() =>
      submissionToListingInput(submission({ dealType: null }), { locationId: DISTRICT, ...titles }),
    ).toThrow();
  });
});
