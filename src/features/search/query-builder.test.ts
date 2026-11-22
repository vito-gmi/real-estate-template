import { PgDialect } from 'drizzle-orm/pg-core';
import { sql, type SQL } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { parseSearchFilters } from './params';
import { buildFilterConditions, buildOrderBy, cursorValueOf } from './query-builder';

const dialect = new PgDialect();
const render = (condition: SQL) => dialect.sqlToQuery(condition);

describe('price filter', () => {
  /** The rendered price rule, if the filters produced one. */
  function priceRule(searchParams: Record<string, string>) {
    const filters = parseSearchFilters({ dealType: 'sale', searchParams });
    return buildFilterConditions(filters, 'bg')
      .map(render)
      .find((query) => query.sql.includes('"price_eur"'));
  }

  it('adds no price rule without a range', () => {
    expect(priceRule({})).toBeUndefined();
  });

  it('matches the range, plus featured or exclusive listings without a public price', () => {
    const rule = priceRule({ priceMin: '150000', priceMax: '250000' });
    expect(rule?.sql).toBe(
      '(("listings"."price_eur" >= $1 and "listings"."price_eur" <= $2) or ("listings"."price_eur" is null and ("listings"."is_featured" = $3 or "listings"."is_exclusive" = $4)))',
    );
    expect(rule?.params).toEqual(['150000', '250000', true, true]);
  });

  it('never compares the stored price, which stays private when hidden', () => {
    const rule = priceRule({ priceMax: '250000' });
    expect(rule?.sql).not.toMatch(/"listings"\."price"[^_]/);
  });
});

describe('price sorting', () => {
  it('pages on sort keys that park hidden prices last in both directions', () => {
    const orderBy = (sort: 'price_asc' | 'price_desc') =>
      render(sql.join(buildOrderBy(sort), sql`, `)).sql;
    expect(orderBy('price_asc')).toBe('"listings"."sort_price_asc" asc, "listings"."id" asc');
    expect(orderBy('price_desc')).toBe('"listings"."sort_price_desc" desc, "listings"."id" desc');
    expect(
      cursorValueOf('price_desc', {
        publishedAt: null,
        sortPriceAsc: 999999999,
        sortPriceDesc: -1,
        sortArea: 0,
        sortPricePerSqm: 999999999,
      }),
    ).toBe('-1');
  });
});
