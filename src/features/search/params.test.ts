import { describe, expect, it } from 'vitest';
import { countActiveFilters, isPristine, parseSearchFilters, serializeSearchFilters } from './params';

const base = { dealType: 'sale' as const };

describe('search parameter codec', () => {
  it('defaults to an empty, newest-first search', () => {
    const filters = parseSearchFilters({ ...base, searchParams: {} });

    expect(filters.sort).toBe('newest');
    expect(filters.kinds).toEqual([]);
    expect(filters.featuredOnly).toBe(false);
    expect(isPristine(filters)).toBe(true);
  });

  it('parses comma-separated enum lists and drops unknown members', () => {
    const filters = parseSearchFilters({
      ...base,
      searchParams: { kinds: 'apartment,house,teleporter' },
    });

    // One bad member invalidates the list rather than silently narrowing the
    // search to something the visitor did not ask for.
    expect(filters.kinds).toEqual([]);
  });

  it('keeps a fully valid enum list', () => {
    const filters = parseSearchFilters({ ...base, searchParams: { kinds: 'apartment,house' } });
    expect(filters.kinds).toEqual(['apartment', 'house']);
  });

  it('normalises swapped numeric bounds instead of returning nothing', () => {
    const filters = parseSearchFilters({
      ...base,
      searchParams: { priceMin: '300000', priceMax: '100000' },
    });

    expect(filters.priceMin).toBe(100000);
    expect(filters.priceMax).toBe(300000);
  });

  it('ignores junk values rather than throwing', () => {
    const filters = parseSearchFilters({
      ...base,
      searchParams: { priceMin: 'abc', roomsMin: '-4', sort: 'by_vibes', q: 'x' },
    });

    expect(filters.priceMin).toBeUndefined();
    expect(filters.roomsMin).toBeUndefined();
    expect(filters.sort).toBe('newest');
    expect(filters.keyword).toBeUndefined();
  });

  it('serialises to a stable, order-independent query string', () => {
    const a = parseSearchFilters({
      ...base,
      searchParams: { kinds: 'house,apartment', priceMax: '250000', features: 'garage,elevator' },
    });
    const b = parseSearchFilters({
      ...base,
      searchParams: { features: 'elevator,garage', kinds: 'apartment,house', priceMax: '250000' },
    });

    expect(serializeSearchFilters(a).toString()).toBe(serializeSearchFilters(b).toString());
  });

  it('round-trips through the query string without losing filters', () => {
    const original = parseSearchFilters({
      ...base,
      searchParams: {
        kinds: 'apartment',
        priceMin: '80000',
        priceMax: '250000',
        areaMin: '55',
        roomsMin: '2',
        features: 'elevator,parking',
        heating: 'central',
        q: 'Лозенец',
        featured: '1',
        sort: 'price_asc',
      },
    });

    const roundTripped = parseSearchFilters({
      ...base,
      searchParams: Object.fromEntries(serializeSearchFilters(original)),
    });

    expect(roundTripped).toEqual(original);
  });

  it('counts active refinements without counting the sort order', () => {
    const filters = parseSearchFilters({
      ...base,
      searchParams: { kinds: 'apartment', priceMax: '250000', sort: 'price_asc' },
    });

    expect(countActiveFilters(filters)).toBe(2);
  });
});
