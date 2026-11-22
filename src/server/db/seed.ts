import "./script-env.ts";

import { sql } from "drizzle-orm";
import sharp from "sharp";
import {
  conditions,
  constructionTypes,
  furnishingTypes,
  heatingTypes,
  type Condition,
  type ConstructionType,
  type DealType,
  type FurnishingType,
  type HeatingType,
  type ListingStatus,
  type PropertyKind,
} from "@/lib/domain/enums";
import type { CoverImage } from "@/lib/domain/media";
import { slugify } from "@/lib/utils";
import { processImage, type ProcessedImage } from "@/features/media/pipeline";
import { storage } from "@/server/adapters/storage";
import { db } from "./client.ts";
import {
  features,
  listingFeatures,
  listingTranslations,
  listings,
  locations,
  media,
} from "./schema/index.ts";
import {
  createRandom,
  listingDescription,
  listingTitle,
  seedFeatures,
  seedRegions,
  type SeedCity,
  type SeedDistrict,
} from "./seed-data.ts";

const LISTING_COUNT = 60;
const BASE_IMAGE_COUNT = 12;
const PHOTOS_PER_LISTING = 3;

const random = createRandom(20260901);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}

function pickWeighted<T extends string>(
  weights: Readonly<Record<T, number>>,
): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let threshold = random() * total;
  for (const [value, weight] of entries) {
    threshold -= weight;
    if (threshold <= 0) return value;
  }
  return entries[0]![0];
}

function between(min: number, max: number, step = 1): number {
  const value = min + random() * (max - min);
  return Math.round(value / step) * step;
}

function maybe(probability: number): boolean {
  return random() < probability;
}

// ---------------------------------------------------------------------------
// Procedural photography
//
// Generating gradient images locally keeps the seed offline and license-free
// while still exercising the real derivative pipeline, so a fresh clone shows a
// populated, image-rich site rather than grey placeholders.
// ---------------------------------------------------------------------------

const PALETTES: ReadonlyArray<readonly [string, string, string]> = [
  ["#1f3a5f", "#4a6fa5", "#c9d6e8"],
  ["#2d4739", "#6a9955", "#dbe8d4"],
  ["#5c3a2e", "#b07d62", "#f0dfd2"],
  ["#3a2e5c", "#7a6aa5", "#ded8f0"],
  ["#5c2e3a", "#a5627a", "#f0d2dd"],
  ["#2e4f5c", "#62909f", "#d2e6f0"],
];

async function makeBaseImage(index: number): Promise<Buffer> {
  const palette = PALETTES[index % PALETTES.length]!;
  const [dark, mid, light] = palette;
  const angle = (index * 37) % 90;
  const horizon = 55 + ((index * 7) % 20);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1067">
    <defs>
      <linearGradient id="sky" gradientTransform="rotate(${angle})">
        <stop offset="0%" stop-color="${light}"/>
        <stop offset="100%" stop-color="${mid}"/>
      </linearGradient>
      <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${mid}"/>
        <stop offset="100%" stop-color="${dark}"/>
      </linearGradient>
    </defs>
    <rect width="1600" height="1067" fill="url(#sky)"/>
    <rect y="${horizon * 10}" width="1600" height="1067" fill="url(#ground)"/>
    <g opacity="0.5">
      <rect x="${120 + index * 23}" y="${240 + (index % 5) * 30}" width="300" height="520" fill="${dark}"/>
      <rect x="${520 + index * 17}" y="${180 + (index % 3) * 45}" width="240" height="600" fill="${mid}"/>
      <rect x="${900 + index * 11}" y="${300 - (index % 4) * 25}" width="360" height="480" fill="${dark}"/>
    </g>
    <circle cx="${1350 - index * 30}" cy="${180 + (index % 6) * 20}" r="70" fill="${light}" opacity="0.75"/>
  </svg>`;

  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

function coverFrom(processed: ProcessedImage, mediaId: string): CoverImage {
  return {
    mediaId,
    width: processed.width,
    height: processed.height,
    blurDataUrl: processed.blurDataUrl,
    variants: processed.variants,
  };
}

// ---------------------------------------------------------------------------
// Listing shape by property kind
// ---------------------------------------------------------------------------

type KindProfile = {
  readonly areaRange: readonly [number, number];
  readonly salePerSqm: readonly [number, number];
  readonly rentPerSqm: readonly [number, number];
  readonly hasRooms: boolean;
  readonly hasLand: boolean;
};

const KIND_PROFILES: Readonly<Record<PropertyKind, KindProfile>> = {
  apartment: {
    areaRange: [38, 190],
    salePerSqm: [1400, 3600],
    rentPerSqm: [7, 16],
    hasRooms: true,
    hasLand: false,
  },
  house: {
    areaRange: [110, 420],
    salePerSqm: [900, 2400],
    rentPerSqm: [5, 12],
    hasRooms: true,
    hasLand: true,
  },
  house_floor: {
    areaRange: [70, 180],
    salePerSqm: [900, 2000],
    rentPerSqm: [5, 11],
    hasRooms: true,
    hasLand: false,
  },
  land: {
    areaRange: [0, 0],
    salePerSqm: [60, 420],
    rentPerSqm: [1, 4],
    hasRooms: false,
    hasLand: true,
  },
  office: {
    areaRange: [40, 480],
    salePerSqm: [1200, 2800],
    rentPerSqm: [9, 20],
    hasRooms: false,
    hasLand: false,
  },
  retail: {
    areaRange: [35, 320],
    salePerSqm: [1300, 3200],
    rentPerSqm: [12, 30],
    hasRooms: false,
    hasLand: false,
  },
  industrial: {
    areaRange: [300, 2400],
    salePerSqm: [350, 900],
    rentPerSqm: [3, 7],
    hasRooms: false,
    hasLand: true,
  },
  garage: {
    areaRange: [14, 32],
    salePerSqm: [700, 1600],
    rentPerSqm: [3, 8],
    hasRooms: false,
    hasLand: false,
  },
  hotel: {
    areaRange: [400, 2600],
    salePerSqm: [900, 2200],
    rentPerSqm: [6, 14],
    hasRooms: true,
    hasLand: true,
  },
  agricultural: {
    areaRange: [0, 0],
    salePerSqm: [1, 6],
    rentPerSqm: [0.05, 0.3],
    hasRooms: false,
    hasLand: true,
  },
};

const KIND_WEIGHTS: Readonly<Record<PropertyKind, number>> = {
  apartment: 52,
  house: 14,
  house_floor: 5,
  land: 8,
  office: 7,
  retail: 5,
  garage: 4,
  industrial: 2,
  hotel: 2,
  agricultural: 1,
};

/** Sofia dominates the Bulgarian market, and the demo data should reflect that. */
const CITY_WEIGHTS: Readonly<Record<string, number>> = {
  sofia: 50,
  plovdiv: 12,
  varna: 12,
  burgas: 8,
  bansko: 8,
  sozopol: 5,
  nesebar: 3,
  "veliko-tarnovo": 2,
};

async function main() {
  console.log("→ clearing existing demo data");
  await db.execute(
    sql`truncate table ${listingFeatures}, ${media}, ${listingTranslations}, ${listings}, ${features}, ${locations} restart identity cascade`,
  );

  // -- Locations -----------------------------------------------------------
  console.log("→ inserting locations");
  const [country] = await db
    .insert(locations)
    .values({
      level: "country",
      nameBg: "България",
      nameEn: "Bulgaria",
      slugBg: "bulgaria",
      slugEn: "bulgaria",
      lat: 42.7339,
      lng: 25.4858,
    })
    .returning({ id: locations.id });

  type CityRecord = { id: string; regionId: string; city: SeedCity };
  type DistrictRecord = {
    id: string;
    district: SeedDistrict;
    city: CityRecord;
  };

  const cityRecords: CityRecord[] = [];
  const districtRecords: DistrictRecord[] = [];

  for (const [regionIndex, region] of seedRegions.entries()) {
    const [regionRow] = await db
      .insert(locations)
      .values({
        parentId: country!.id,
        level: "region",
        nameBg: region.nameBg,
        nameEn: region.nameEn,
        slugBg: region.slug,
        slugEn: region.slug,
        sortOrder: regionIndex,
      })
      .returning({ id: locations.id });

    for (const [cityIndex, city] of region.cities.entries()) {
      const [cityRow] = await db
        .insert(locations)
        .values({
          parentId: regionRow!.id,
          level: "city",
          nameBg: city.nameBg,
          nameEn: city.nameEn,
          slugBg: city.slug,
          slugEn: city.slug,
          lat: city.lat,
          lng: city.lng,
          sortOrder: cityIndex,
        })
        .returning({ id: locations.id });

      const cityRecord: CityRecord = {
        id: cityRow!.id,
        regionId: regionRow!.id,
        city,
      };
      cityRecords.push(cityRecord);

      for (const [districtIndex, district] of city.districts.entries()) {
        const [districtRow] = await db
          .insert(locations)
          .values({
            parentId: cityRow!.id,
            level: "district",
            nameBg: district.nameBg,
            nameEn: district.nameEn,
            slugBg: district.slug,
            slugEn: district.slug,
            lat: district.lat,
            lng: district.lng,
            sortOrder: districtIndex,
          })
          .returning({ id: locations.id });

        districtRecords.push({
          id: districtRow!.id,
          district,
          city: cityRecord,
        });
      }
    }
  }

  // -- Features ------------------------------------------------------------
  console.log("→ inserting features");
  const featureRows = await db
    .insert(features)
    .values(
      seedFeatures.map((feature, index) => ({
        key: feature.key,
        category: feature.category,
        nameBg: feature.nameBg,
        nameEn: feature.nameEn,
        icon: feature.icon,
        sortOrder: index,
      })),
    )
    .returning({ id: features.id, key: features.key });

  // -- Photographs ---------------------------------------------------------
  console.log(
    `→ generating ${BASE_IMAGE_COUNT} base images and their derivatives`,
  );
  const store = storage();
  const processedImages: ProcessedImage[] = [];
  for (let index = 0; index < BASE_IMAGE_COUNT; index += 1) {
    processedImages.push(await processImage(store, await makeBaseImage(index)));
    process.stdout.write(`\r  ${index + 1}/${BASE_IMAGE_COUNT}`);
  }
  process.stdout.write("\n");

  // -- Listings ------------------------------------------------------------
  console.log(`→ inserting ${LISTING_COUNT} listings`);
  const usedSlugs = new Set<string>();

  for (let index = 0; index < LISTING_COUNT; index += 1) {
    const districtRecord = pickDistrict(districtRecords);
    const { district, city } = districtRecord;

    const kind = pickWeighted(KIND_WEIGHTS);
    const profile = KIND_PROFILES[kind];
    const dealType: DealType = maybe(0.75) ? "sale" : "rent";

    const area =
      profile.areaRange[1] > 0
        ? between(profile.areaRange[0], profile.areaRange[1])
        : null;
    const landArea = profile.hasLand ? between(200, 2500, 10) : null;
    const sizeForPrice = area ?? landArea ?? 100;

    const perSqm =
      dealType === "sale"
        ? between(profile.salePerSqm[0], profile.salePerSqm[1])
        : between(profile.rentPerSqm[0] * 100, profile.rentPerSqm[1] * 100) /
          100;

    const rawPrice = perSqm * sizeForPrice;
    const price =
      dealType === "sale"
        ? Math.round(rawPrice / 500) * 500
        : Math.max(150, Math.round(rawPrice / 10) * 10);
    // Some listings are "price on request": a few keep a stored price behind
    // the switch, the rest never had one.
    const pricing = pickWeighted({ shown: 80, hidden: 12, none: 8 });

    const rooms = profile.hasRooms ? between(1, 5) : null;
    const bedrooms = rooms ? Math.max(1, rooms - 1) : null;
    const floorsTotal = kind === "apartment" ? between(3, 12) : between(1, 3);
    const floor = kind === "apartment" ? between(1, floorsTotal) : null;

    const status: ListingStatus = pickWeighted<ListingStatus>({
      active: 78,
      reserved: 8,
      draft: 6,
      sold: 5,
      rented: 2,
      archived: 1,
    });

    const publishedAt =
      status === "draft"
        ? null
        : new Date(
            Date.now() -
              between(0, 240) * 86_400_000 -
              between(0, 86_400) * 1000,
          );

    const titleBg = listingTitle(
      "bg",
      kind,
      rooms,
      district.nameBg,
      city.city.nameBg,
    );
    const titleEn = listingTitle(
      "en",
      kind,
      rooms,
      district.nameEn,
      city.city.nameEn,
    );

    const [listingRow] = await db
      .insert(listings)
      .values({
        dealType,
        propertyKind: kind,
        status,
        price: pricing === "none" ? null : price,
        currency: "EUR",
        showPrice: pricing === "shown",
        area,
        landArea,
        rooms,
        bedrooms,
        bathrooms: rooms ? Math.max(1, Math.ceil(rooms / 3)) : null,
        floor,
        floorsTotal,
        yearBuilt: maybe(0.8) ? between(1968, 2026) : null,
        constructionType: profile.hasRooms
          ? pick<ConstructionType>(constructionTypes)
          : null,
        heating: profile.hasRooms ? pick<HeatingType>(heatingTypes) : null,
        furnishing: profile.hasRooms
          ? pick<FurnishingType>(furnishingTypes)
          : null,
        condition: pick<Condition>(conditions),
        energyLabel: maybe(0.4) ? pick(["A", "B", "C", "D"]) : null,
        maintenanceFee:
          dealType === "rent" && maybe(0.5) ? between(10, 90, 5) : null,
        depositMonths: dealType === "rent" ? pick([1, 1, 2]) : null,
        locationId: districtRecord.id,
        cityId: city.id,
        regionId: city.regionId,
        address: `ул. „Пример“ ${between(1, 120)}`,
        hideExactAddress: maybe(0.7),
        lat: district.lat + (random() - 0.5) * 0.012,
        lng: district.lng + (random() - 0.5) * 0.016,
        isFeatured: maybe(0.18),
        isExclusive: maybe(0.25),
        viewCount: between(0, 1400),
        publishedAt,
      })
      .returning({ id: listings.id, reference: listings.reference });

    const listingId = listingRow!.id;
    const reference = listingRow!.reference;

    const slugFor = (title: string) => {
      const base = `${slugify(title)}-${reference}`;
      let candidate = base;
      let suffix = 2;
      while (usedSlugs.has(candidate)) candidate = `${base}-${suffix++}`;
      usedSlugs.add(candidate);
      return candidate;
    };

    await db.insert(listingTranslations).values([
      {
        listingId,
        locale: "bg",
        title: titleBg,
        description: listingDescription("bg", index),
        slug: slugFor(titleBg),
      },
      {
        listingId,
        locale: "en",
        title: titleEn,
        description: listingDescription("en", index),
        slug: slugFor(titleEn),
      },
    ]);

    // Features: three to seven per listing.
    const shuffled = [...featureRows].sort(() => random() - 0.5);
    const chosen = shuffled.slice(0, between(3, 7));
    await db
      .insert(listingFeatures)
      .values(chosen.map((feature) => ({ listingId, featureId: feature.id })));

    // Photos reuse the pre-processed pool; keys are content-addressed, so the
    // objects are shared rather than duplicated.
    let cover: CoverImage | null = null;
    for (let photoIndex = 0; photoIndex < PHOTOS_PER_LISTING; photoIndex += 1) {
      const processed =
        processedImages[
          (index * PHOTOS_PER_LISTING + photoIndex) % processedImages.length
        ]!;
      const [mediaRow] = await db
        .insert(media)
        .values({
          listingId,
          kind: "photo",
          storageKey: processed.storageKey,
          contentType: processed.contentType,
          bytes: processed.bytes,
          width: processed.width,
          height: processed.height,
          blurDataUrl: processed.blurDataUrl,
          variants: [...processed.variants],
          altBg: `${titleBg} — снимка ${photoIndex + 1}`,
          altEn: `${titleEn} — photo ${photoIndex + 1}`,
          sortOrder: photoIndex,
        })
        .returning({ id: media.id });

      if (photoIndex === 0) cover = coverFrom(processed, mediaRow!.id);
    }

    await db
      .update(listings)
      .set({ coverImage: cover })
      .where(sql`${listings.id} = ${listingId}`);

    process.stdout.write(`\r  ${index + 1}/${LISTING_COUNT}`);
  }
  process.stdout.write("\n");

  console.log("→ refreshing facet counts");
  await db.execute(sql`select refresh_listing_facet_counts()`);

  console.log(
    `✓ seeded ${LISTING_COUNT} listings across ${districtRecords.length} districts`,
  );
  process.exit(0);
}

function pickDistrict<T extends { city: { city: { slug: string } } }>(
  records: readonly T[],
): T {
  // Weighted by city so the demo catalogue mirrors real market distribution.
  const pool = records.flatMap((record) => {
    const weight = CITY_WEIGHTS[record.city.city.slug] ?? 1;
    return Array.from(
      { length: Math.max(1, Math.round(weight / 4)) },
      () => record,
    );
  });
  return pick(pool);
}

main().catch((error: unknown) => {
  console.error("✗ seeding failed");
  console.error(error);
  process.exit(1);
});
