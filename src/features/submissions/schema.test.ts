import { describe, expect, it } from 'vitest';
import { submissionSchema, type SubmissionInput } from './schema';

const CITY = '3f1b9a2c-1c2d-4a5b-8c9d-0e1f2a3b4c5d';

/** What the form sends for a sensible submission: numbers arrive as strings. */
function valid(overrides: Partial<SubmissionInput> = {}): SubmissionInput {
  return {
    dealType: 'sale',
    propertyKind: 'apartment',
    cityId: CITY,
    districtId: '',
    price: '185 000',
    currency: 'EUR',
    area: '78.5',
    rooms: '3',
    floor: '4',
    floorsTotal: '8',
    description: 'Bright three-room flat, renovated in 2022, south-facing balcony.',
    firstName: 'Maria',
    lastName: 'Petrova',
    email: 'maria@example.com',
    phone: '+359 88 123 4567',
    consent: true,
    website: '',
    ...overrides,
  };
}

function messages(result: ReturnType<typeof submissionSchema.safeParse>): Record<string, string> {
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
}

describe('submissionSchema', () => {
  it('accepts a complete submission and normalises form strings', () => {
    const result = submissionSchema.safeParse(valid());
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.price).toBe(185_000);
    expect(result.data.area).toBe(78.5);
    expect(result.data.rooms).toBe(3);
    // An empty select means "not chosen", not an invalid id.
    expect(result.data.districtId).toBeUndefined();
    expect(result.data.photoIds).toEqual([]);
    expect(result.data.submitterRole).toBe('owner');
  });

  it('needs either a city from the list or a typed place', () => {
    expect(messages(submissionSchema.safeParse(valid({ cityId: '' })))).toMatchObject({
      cityId: 'submit.errors.location',
    });
    expect(
      submissionSchema.safeParse(valid({ cityId: '', locationText: 'Bankya' })).success,
    ).toBe(true);
  });

  it('reports cross-field problems together with field errors', () => {
    const result = messages(
      submissionSchema.safeParse(valid({ cityId: '', description: 'short', floor: '9', floorsTotal: '8' })),
    );
    expect(result).toMatchObject({
      cityId: 'submit.errors.location',
      description: 'submit.errors.description',
      floor: 'submit.errors.floorAboveTotal',
    });
  });

  it('rejects a floor above the building height', () => {
    expect(messages(submissionSchema.safeParse(valid({ floor: '9', floorsTotal: '8' })))).toMatchObject({
      floor: 'submit.errors.floorAboveTotal',
    });
  });

  it('keeps numbers inside believable, storable ranges', () => {
    const result = submissionSchema.safeParse(
      valid({ rooms: '2.5', yearBuilt: '1700', area: '-5', price: '99999999999' }),
    );
    expect(messages(result)).toMatchObject({
      rooms: 'submit.errors.number',
      yearBuilt: 'submit.errors.number',
      area: 'submit.errors.number',
      price: 'submit.errors.number',
    });
  });

  it('requires a real description, contact details and consent', () => {
    const result = submissionSchema.safeParse(
      valid({
        description: 'Nice flat',
        firstName: 'M',
        email: 'not-an-email',
        phone: 'call me',
        consent: false as unknown as true,
      }),
    );
    expect(messages(result)).toMatchObject({
      description: 'submit.errors.description',
      firstName: 'submit.errors.firstName',
      email: 'submit.errors.email',
      phone: 'submit.errors.phone',
      consent: 'submit.errors.consent',
    });
  });

  it('only accepts http(s) links for extra media', () => {
    expect(
      messages(submissionSchema.safeParse(valid({ externalMediaUrl: 'javascript:alert(1)' }))),
    ).toMatchObject({ externalMediaUrl: 'submit.errors.url' });
    expect(
      submissionSchema.safeParse(valid({ externalMediaUrl: 'https://drive.google.com/x' })).success,
    ).toBe(true);
    const empty = submissionSchema.safeParse(valid({ externalMediaUrl: '' }));
    expect(empty.success && empty.data.externalMediaUrl).toBeUndefined();
  });

  it('caps the number of photos', () => {
    const ids = Array.from({ length: 31 }, (_, index) =>
      `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );
    expect(submissionSchema.safeParse(valid({ photoIds: ids })).success).toBe(false);
    expect(submissionSchema.safeParse(valid({ photoIds: ids.slice(0, 30) })).success).toBe(true);
  });

  it('rejects a filled-in honeypot', () => {
    expect(submissionSchema.safeParse(valid({ website: 'http://spam.example' })).success).toBe(false);
  });
});
