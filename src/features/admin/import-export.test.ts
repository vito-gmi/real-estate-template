import { describe, expect, it } from 'vitest';
import { parseImportPayload, recordsToCsv, recordsToJson, splitCsv } from './import-export';

const sample = {
  dealType: 'sale' as const,
  propertyKind: 'apartment' as const,
  status: 'draft' as const,
  price: 120000,
  currency: 'EUR' as const,
  locationId: '3f1b9a2c-1c2d-4a5b-8c9d-0e1f2a3b4c5d',
  hideExactAddress: true,
  isFeatured: false,
  isExclusive: false,
  titleBg: 'Двустаен апартамент в Лозенец',
  titleEn: 'Two-bedroom apartment in Lozenets',
  descriptionBg: '',
  descriptionEn: '',
  featureKeys: ['elevator', 'garage'],
};

describe('listing import/export', () => {
  it('round-trips JSON', () => {
    const json = recordsToJson([sample]);
    const parsed = parseImportPayload(json, 'listings.json');
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.titleEn).toBe(sample.titleEn);
    expect(parsed[0]?.featureKeys).toEqual(['elevator', 'garage']);
  });

  it('round-trips CSV including quoted Bulgarian titles', () => {
    const csv = recordsToCsv([sample]);
    const parsed = parseImportPayload(csv, 'listings.csv');
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.titleBg).toBe(sample.titleBg);
    expect(parsed[0]?.price).toBe(120000);
  });

  it('keeps a hidden price hidden, and keeps the amount, in both formats', () => {
    const hidden = { ...sample, showPrice: false };
    for (const [payload, name] of [
      [recordsToJson([hidden]), 'listings.json'],
      [recordsToCsv([hidden]), 'listings.csv'],
    ] as const) {
      const [parsed] = parseImportPayload(payload, name);
      expect(parsed?.showPrice).toBe(false);
      expect(parsed?.price).toBe(120000);
    }
  });

  it('shows the price of files exported before prices could be hidden', () => {
    const legacyCsv = recordsToCsv([sample])
      .split('\n')
      .map((line) => line.split(',').filter((_, index) => index !== 6).join(','))
      .join('\n');
    expect(legacyCsv.split('\n')[0]).not.toContain('showPrice');
    expect(parseImportPayload(legacyCsv, 'listings.csv')[0]?.showPrice).toBe(true);

    const legacyJson = JSON.stringify({ listings: [sample] });
    expect(parseImportPayload(legacyJson, 'listings.json')[0]?.showPrice).toBe(true);
  });

  it('imports a listing without a price as price on request', () => {
    const { price: _price, ...withoutPrice } = sample;
    const [parsed] = parseImportPayload(JSON.stringify([withoutPrice]), 'listings.json');
    expect(parsed?.price).toBeUndefined();
    expect(parsed?.showPrice).toBe(false);
  });

  it('rejects a shown price that is missing', () => {
    const { price: _price, ...withoutPrice } = sample;
    expect(() =>
      parseImportPayload(JSON.stringify([{ ...withoutPrice, showPrice: true }]), 'listings.json'),
    ).toThrow(/admin\.errors\.price/);
  });

  it('splits quoted CSV cells', () => {
    expect(splitCsv('a,"b,c",d\n1,2,3')).toEqual([
      ['a', 'b,c', 'd'],
      ['1', '2', '3'],
    ]);
  });
});
