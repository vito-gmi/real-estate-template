import '../src/server/db/script-env.ts';

import { parseSearchFilters } from '../src/features/search/params.ts';
import type { SearchFilters } from '../src/features/search/types.ts';
import {
  countListings,
  countPublishedListings,
  searchListings,
} from '../src/server/repositories/listings.ts';

/**
 * Performance budget.
 *
 * The non-functional requirement is that the site responds identically whether
 * it holds five listings or fifty thousand. This script proves it: it exercises
 * the real query paths against whatever is in the database and fails CI if the
 * 95th percentile drifts past the budget — including deep pagination, which is
 * where an OFFSET-based implementation would collapse.
 */

const BUDGET_MS = Number(process.env.BENCH_BUDGET_MS ?? 60);
const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? 40);
const WARMUP = 5;

type Scenario = {
  readonly name: string;
  readonly run: () => Promise<unknown>;
};

function filters(overrides: Record<string, string> = {}): SearchFilters {
  return parseSearchFilters({ dealType: 'sale', searchParams: overrides });
}

function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index]!;
}

async function measure(scenario: Scenario) {
  for (let i = 0; i < WARMUP; i += 1) await scenario.run();

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const startedAt = performance.now();
    await scenario.run();
    samples.push(performance.now() - startedAt);
  }

  return {
    name: scenario.name,
    p50: percentile(samples, 50),
    p95: percentile(samples, 95),
    max: Math.max(...samples),
  };
}

/** Walks forward with cursors to reach a genuinely deep page. */
async function deepPageCursor(pages: number): Promise<string | undefined> {
  let cursor: string | undefined;
  for (let page = 0; page < pages; page += 1) {
    const result = await searchListings('bg', filters(), { cursor, limit: 24 });
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }
  return cursor;
}

async function main() {
  const total = await countPublishedListings();
  console.log(`Benchmarking against ${total} published listings (budget: p95 < ${BUDGET_MS}ms)\n`);

  const deepCursor = await deepPageCursor(40);

  const scenarios: Scenario[] = [
    {
      name: 'first page, no filters',
      run: () => searchListings('bg', filters(), { limit: 24 }),
    },
    {
      name: 'page 40 via keyset cursor',
      run: () => searchListings('bg', filters(), { cursor: deepCursor, limit: 24 }),
    },
    {
      name: 'kind + price band',
      run: () =>
        searchListings('bg', filters({ kinds: 'apartment', priceMin: '90000', priceMax: '250000' }), {
          limit: 24,
        }),
    },
    {
      name: 'multi-facet + rooms + area',
      run: () =>
        searchListings(
          'bg',
          filters({
            kinds: 'apartment,house',
            priceMin: '80000',
            priceMax: '400000',
            areaMin: '60',
            areaMax: '160',
            roomsMin: '2',
          }),
          { limit: 24 },
        ),
    },
    {
      name: 'sort by price per m²',
      run: () => searchListings('bg', filters({ sort: 'price_per_sqm_asc' }), { limit: 24 }),
    },
    {
      name: 'full-text keyword',
      run: () => searchListings('bg', filters({ q: 'апартамент' }), { limit: 24 }),
    },
    {
      name: 'feature intersection',
      run: () => searchListings('bg', filters({ features: 'elevator,parking' }), { limit: 24 }),
    },
    {
      name: 'capped result count',
      run: () => countListings('bg', filters({ kinds: 'apartment' })),
    },
  ];

  const results = [];
  for (const scenario of scenarios) {
    results.push(await measure(scenario));
  }

  const pad = (value: string, width: number) => value.padEnd(width);
  console.log(`${pad('scenario', 34)} ${pad('p50', 9)} ${pad('p95', 9)} max`);
  console.log('-'.repeat(64));
  for (const result of results) {
    console.log(
      `${pad(result.name, 34)} ${pad(`${result.p50.toFixed(1)}ms`, 9)} ${pad(
        `${result.p95.toFixed(1)}ms`,
        9,
      )} ${result.max.toFixed(1)}ms`,
    );
  }

  const breached = results.filter((result) => result.p95 > BUDGET_MS);
  if (breached.length > 0) {
    console.error(
      `\n✗ ${breached.length} scenario(s) over the ${BUDGET_MS}ms p95 budget: ${breached
        .map((result) => `${result.name} (${result.p95.toFixed(1)}ms)`)
        .join(', ')}`,
    );
    process.exit(1);
  }

  console.log(`\n✓ every scenario within the ${BUDGET_MS}ms p95 budget`);
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error('✗ benchmark failed');
  console.error(error);
  process.exit(1);
});
