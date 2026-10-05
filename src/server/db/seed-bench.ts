import "./script-env.ts";

import { eq, sql } from "drizzle-orm";
import {
  conditions,
  constructionTypes,
  furnishingTypes,
  heatingTypes,
  propertyKinds,
  type Condition,
  type ConstructionType,
  type DealType,
  type FurnishingType,
  type HeatingType,
  type PropertyKind,
} from "@/lib/domain/enums";
import { db } from "./client.ts";
import { listingTranslations, listings, locations } from "./schema/index.ts";
import { createRandom } from "./seed-data.ts";

/**
 * Bulk synthetic data for the performance budget.
 *
 * The non-functional requirement is that the site behaves identically with five
 * listings and with fifty thousand. This script produces that second case so CI
 * can prove it rather than assume it. Photos are skipped — the search path never
 * touches the media table, because the cover image is denormalised onto the row.
 */

const TARGET_ROWS = Number(process.env.BENCH_ROWS ?? 50_000);
const CHUNK = 2_000;

const random = createRandom(424242);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}

function between(min: number, max: number): number {
  return Math.round(min + random() * (max - min));
}

async function main() {
  const districts = await db
    .select({ id: locations.id, parentId: locations.parentId })
    .from(locations)
    .where(eq(locations.level, "district"));

  if (districts.length === 0) {
    throw new Error(
      "Run `npm run db:seed` first — the benchmark reuses its location tree.",
    );
  }

  const cities = await db
    .select({ id: locations.id, parentId: locations.parentId })
    .from(locations)
    .where(eq(locations.level, "city"));

  const cityParent = new Map(cities.map((city) => [city.id, city.parentId]));

  const existing = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listings);
  const alreadyThere = existing[0]?.count ?? 0;
  const toCreate = Math.max(0, TARGET_ROWS - alreadyThere);

  if (toCreate === 0) {
    console.log(`✓ ${alreadyThere} listings already present, nothing to add`);
    process.exit(0);
  }

  console.log(
    `→ inserting ${toCreate} synthetic listings (existing: ${alreadyThere})`,
  );
  const startedAt = Date.now();

  for (let offset = 0; offset < toCreate; offset += CHUNK) {
    const size = Math.min(CHUNK, toCreate - offset);

    const rows = Array.from({ length: size }, () => {
      const district = pick(districts);
      const cityId = district.parentId;
      const kind: PropertyKind = pick(propertyKinds);
      const dealType: DealType = random() < 0.75 ? "sale" : "rent";
      const area = between(30, 350);

      return {
        dealType,
        propertyKind: kind,
        status: "active" as const,
        price:
          dealType === "sale" ? between(40_000, 900_000) : between(300, 4_000),
        currency: "EUR" as const,
        area,
        rooms: between(1, 6),
        bedrooms: between(1, 4),
        bathrooms: between(1, 3),
        floor: between(1, 12),
        floorsTotal: between(3, 14),
        yearBuilt: between(1965, 2026),
        constructionType: pick<ConstructionType>(constructionTypes),
        heating: pick<HeatingType>(heatingTypes),
        furnishing: pick<FurnishingType>(furnishingTypes),
        condition: pick<Condition>(conditions),
        locationId: district.id,
        cityId,
        regionId: cityId ? (cityParent.get(cityId) ?? null) : null,
        hideExactAddress: true,
        publishedAt: new Date(Date.now() - between(0, 900) * 86_400_000),
      };
    });

    const inserted = await db
      .insert(listings)
      .values(rows)
      .returning({ id: listings.id, reference: listings.reference });

    await db.insert(listingTranslations).values(
      inserted.flatMap((row) => [
        {
          listingId: row.id,
          locale: "bg" as const,
          title: `Синтетичен имот ${row.reference}`,
          description:
            "Генериран запис за измерване на производителността при голям каталог.",
          slug: `sintetichen-imot-${row.reference}`,
        },
        {
          listingId: row.id,
          locale: "en" as const,
          title: `Synthetic property ${row.reference}`,
          description:
            "Generated record used to measure performance on a large catalogue.",
          slug: `synthetic-property-${row.reference}`,
        },
      ]),
    );

    process.stdout.write(
      `\r  ${Math.min(offset + size, toCreate)}/${toCreate}`,
    );
  }
  process.stdout.write("\n");

  console.log("→ refreshing facet counts");
  await db.execute(sql`select refresh_listing_facet_counts()`);

  console.log("→ analysing tables so the planner has fresh statistics");
  await db.execute(sql`analyze listings`);
  await db.execute(sql`analyze listing_translations`);

  console.log(`✓ done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("✗ benchmark seeding failed");
  console.error(error);
  process.exit(1);
});
