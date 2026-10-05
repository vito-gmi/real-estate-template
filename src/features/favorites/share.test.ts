import { describe, expect, it } from 'vitest';
import { decodeFavoriteIds, encodeFavoriteIds } from './share';

const IDS = [
  '3f1b9a2c-1c2d-4a5b-8c9d-0e1f2a3b4c5d',
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  '00000000-0000-4000-8000-000000000001',
];

describe('favourite list sharing', () => {
  it('round-trips ids in order', () => {
    expect(decodeFavoriteIds(encodeFavoriteIds(IDS))).toEqual(IDS);
  });

  it('is far more compact than a comma-separated list', () => {
    const encoded = encodeFavoriteIds(IDS);
    expect(encoded.length).toBeLessThan(IDS.join(',').length / 1.5);
  });

  it('is URL-safe', () => {
    expect(encodeFavoriteIds(IDS)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('drops values that are not uuids', () => {
    expect(decodeFavoriteIds(encodeFavoriteIds(['nope', IDS[0]!]))).toEqual([IDS[0]]);
  });

  it('returns an empty list for malformed input', () => {
    expect(decodeFavoriteIds('!!!not base64!!!')).toEqual([]);
    expect(decodeFavoriteIds('YWJj')).toEqual([]); // 3 bytes: not a whole uuid
    expect(decodeFavoriteIds('')).toEqual([]);
    expect(decodeFavoriteIds(null)).toEqual([]);
  });
});
