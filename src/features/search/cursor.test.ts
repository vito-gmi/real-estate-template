import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor';

const ID = '3f1b9a2c-1c2d-4a5b-8c9d-0e1f2a3b4c5d';

describe('search cursor', () => {
  it('round-trips a cursor', () => {
    const cursor = { sort: 'newest' as const, value: '1758067200000', id: ID };
    expect(decodeCursor(encodeCursor(cursor), 'newest')).toEqual(cursor);
  });

  it('round-trips decimal sort values', () => {
    const cursor = { sort: 'price_per_sqm_asc' as const, value: '1879.31', id: ID };
    expect(decodeCursor(encodeCursor(cursor), 'price_per_sqm_asc')).toEqual(cursor);
  });

  it('rejects a cursor issued for a different sort order', () => {
    const cursor = encodeCursor({ sort: 'price_asc', value: '100', id: ID });
    expect(decodeCursor(cursor, 'newest')).toBeUndefined();
  });

  it('rejects a cursor whose id is not a uuid', () => {
    const cursor = encodeCursor({ sort: 'newest', value: '1', id: 'not-a-uuid' });
    expect(decodeCursor(cursor, 'newest')).toBeUndefined();
  });

  it('treats malformed input as "start from the first page"', () => {
    expect(decodeCursor('%%%not-base64%%%', 'newest')).toBeUndefined();
    expect(decodeCursor('', 'newest')).toBeUndefined();
    expect(decodeCursor(undefined, 'newest')).toBeUndefined();
  });
});
