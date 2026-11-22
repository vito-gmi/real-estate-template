import { describe, expect, it } from 'vitest';
import { toListingCard, type ListingCardRow } from './mappers';

const row: ListingCardRow = {
  id: '3f1b9a2c-1c2d-4a5b-8c9d-0e1f2a3b4c5d',
  reference: 100427,
  dealType: 'sale',
  propertyKind: 'apartment',
  status: 'active',
  price: 245000,
  currency: 'EUR',
  showPrice: true,
  priceEur: 245000,
  pricePerSqmEur: 2722.22,
  area: 90,
  landArea: null,
  rooms: 3,
  bedrooms: 2,
  floor: 4,
  floorsTotal: 8,
  coverImage: null,
  isFeatured: false,
  isExclusive: false,
  publishedAt: new Date('2026-11-01T10:00:00Z'),
  title: 'Three-room apartment',
  slug: 'three-room-apartment-100427',
  city: null,
  district: null,
};

describe('listing card price', () => {
  it('carries a shown price', () => {
    expect(toListingCard('en', row).price).toEqual({
      amount: 245000,
      currency: 'EUR',
      eur: 245000,
      perSqmEur: 2722.22,
    });
  });

  it('drops a hidden price entirely, so the stored amount never reaches the page', () => {
    // The generated columns are already null when hidden; the raw price is not.
    const hidden = { ...row, showPrice: false, priceEur: null, pricePerSqmEur: null };
    const card = toListingCard('en', hidden);
    expect(card.price).toBeNull();
    expect(JSON.stringify(card)).not.toContain('245000');
  });

  it('treats a listing without a price as price on request', () => {
    expect(toListingCard('en', { ...row, price: null, showPrice: false }).price).toBeNull();
  });
});
