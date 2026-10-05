import type { PropertyKind } from "@/lib/domain/enums";

/**
 * Demo taxonomy and copy.
 *
 * Real Bulgarian regions, cities and Sofia neighbourhoods, so a fresh clone of
 * the template looks like a working agency site rather than lorem ipsum. All of
 * it is data — swapping in another country's geography requires no code change.
 */

export type SeedDistrict = {
  readonly nameBg: string;
  readonly nameEn: string;
  readonly slug: string;
  readonly lat: number;
  readonly lng: number;
};

export type SeedCity = {
  readonly nameBg: string;
  readonly nameEn: string;
  readonly slug: string;
  readonly lat: number;
  readonly lng: number;
  readonly districts: readonly SeedDistrict[];
};

export type SeedRegion = {
  readonly nameBg: string;
  readonly nameEn: string;
  readonly slug: string;
  readonly cities: readonly SeedCity[];
};

const sofiaDistricts: readonly SeedDistrict[] = [
  {
    nameBg: "Лозенец",
    nameEn: "Lozenets",
    slug: "lozenets",
    lat: 42.6739,
    lng: 23.3245,
  },
  {
    nameBg: "Център",
    nameEn: "City Centre",
    slug: "centar",
    lat: 42.6934,
    lng: 23.3253,
  },
  {
    nameBg: "Оборище",
    nameEn: "Oborishte",
    slug: "oborishte",
    lat: 42.6989,
    lng: 23.3405,
  },
  {
    nameBg: "Иван Вазов",
    nameEn: "Ivan Vazov",
    slug: "ivan-vazov",
    lat: 42.6797,
    lng: 23.3096,
  },
  {
    nameBg: "Гео Милев",
    nameEn: "Geo Milev",
    slug: "geo-milev",
    lat: 42.6787,
    lng: 23.3627,
  },
  {
    nameBg: "Редута",
    nameEn: "Reduta",
    slug: "reduta",
    lat: 42.6802,
    lng: 23.3556,
  },
  {
    nameBg: "Изгрев",
    nameEn: "Izgrev",
    slug: "izgrev",
    lat: 42.6663,
    lng: 23.3488,
  },
  {
    nameBg: "Младост 1",
    nameEn: "Mladost 1",
    slug: "mladost-1",
    lat: 42.6503,
    lng: 23.3777,
  },
  {
    nameBg: "Младост 4",
    nameEn: "Mladost 4",
    slug: "mladost-4",
    lat: 42.6284,
    lng: 23.3776,
  },
  {
    nameBg: "Студентски град",
    nameEn: "Studentski Grad",
    slug: "studentski-grad",
    lat: 42.6503,
    lng: 23.3474,
  },
  {
    nameBg: "Люлин 5",
    nameEn: "Lyulin 5",
    slug: "lyulin-5",
    lat: 42.7185,
    lng: 23.2494,
  },
  {
    nameBg: "Красно село",
    nameEn: "Krasno Selo",
    slug: "krasno-selo",
    lat: 42.6822,
    lng: 23.2949,
  },
  {
    nameBg: "Манастирски ливади",
    nameEn: "Manastirski Livadi",
    slug: "manastirski-livadi",
    lat: 42.6579,
    lng: 23.2951,
  },
  {
    nameBg: "Кръстова вада",
    nameEn: "Krastova Vada",
    slug: "krastova-vada",
    lat: 42.6521,
    lng: 23.3213,
  },
  {
    nameBg: "Витоша",
    nameEn: "Vitosha",
    slug: "vitosha",
    lat: 42.6408,
    lng: 23.2963,
  },
  {
    nameBg: "Бояна",
    nameEn: "Boyana",
    slug: "boyana",
    lat: 42.6449,
    lng: 23.2637,
  },
  {
    nameBg: "Драгалевци",
    nameEn: "Dragalevtsi",
    slug: "dragalevtsi",
    lat: 42.6314,
    lng: 23.3153,
  },
  {
    nameBg: "Симеоново",
    nameEn: "Simeonovo",
    slug: "simeonovo",
    lat: 42.6205,
    lng: 23.3396,
  },
];

const plovdivDistricts: readonly SeedDistrict[] = [
  {
    nameBg: "Център",
    nameEn: "City Centre",
    slug: "centar",
    lat: 42.1425,
    lng: 24.7494,
  },
  {
    nameBg: "Кършияка",
    nameEn: "Karshiyaka",
    slug: "karshiyaka",
    lat: 42.1587,
    lng: 24.7462,
  },
  {
    nameBg: "Тракия",
    nameEn: "Trakiya",
    slug: "trakiya",
    lat: 42.1445,
    lng: 24.7863,
  },
  {
    nameBg: "Каменица",
    nameEn: "Kamenitsa",
    slug: "kamenitsa",
    lat: 42.1478,
    lng: 24.7691,
  },
];

const varnaDistricts: readonly SeedDistrict[] = [
  {
    nameBg: "Център",
    nameEn: "City Centre",
    slug: "centar",
    lat: 43.2073,
    lng: 27.9147,
  },
  {
    nameBg: "Гръцка махала",
    nameEn: "Greek Quarter",
    slug: "gratska-mahala",
    lat: 43.2035,
    lng: 27.9214,
  },
  { nameBg: "Бриз", nameEn: "Briz", slug: "briz", lat: 43.2247, lng: 27.9483 },
  {
    nameBg: "Чайка",
    nameEn: "Chayka",
    slug: "chayka",
    lat: 43.2185,
    lng: 27.9351,
  },
];

const burgasDistricts: readonly SeedDistrict[] = [
  {
    nameBg: "Център",
    nameEn: "City Centre",
    slug: "centar",
    lat: 42.4934,
    lng: 27.4722,
  },
  {
    nameBg: "Лазур",
    nameEn: "Lazur",
    slug: "lazur",
    lat: 42.5017,
    lng: 27.4795,
  },
  {
    nameBg: "Сарафово",
    nameEn: "Sarafovo",
    slug: "sarafovo",
    lat: 42.5567,
    lng: 27.5192,
  },
];

export const seedRegions: readonly SeedRegion[] = [
  {
    nameBg: "София-град",
    nameEn: "Sofia City",
    slug: "sofia-grad",
    cities: [
      {
        nameBg: "София",
        nameEn: "Sofia",
        slug: "sofia",
        lat: 42.6977,
        lng: 23.3219,
        districts: sofiaDistricts,
      },
    ],
  },
  {
    nameBg: "Пловдив",
    nameEn: "Plovdiv",
    slug: "plovdiv",
    cities: [
      {
        nameBg: "Пловдив",
        nameEn: "Plovdiv",
        slug: "plovdiv",
        lat: 42.1354,
        lng: 24.7453,
        districts: plovdivDistricts,
      },
    ],
  },
  {
    nameBg: "Варна",
    nameEn: "Varna",
    slug: "varna",
    cities: [
      {
        nameBg: "Варна",
        nameEn: "Varna",
        slug: "varna",
        lat: 43.2141,
        lng: 27.9147,
        districts: varnaDistricts,
      },
    ],
  },
  {
    nameBg: "Бургас",
    nameEn: "Burgas",
    slug: "burgas",
    cities: [
      {
        nameBg: "Бургас",
        nameEn: "Burgas",
        slug: "burgas",
        lat: 42.5048,
        lng: 27.4626,
        districts: burgasDistricts,
      },
      {
        nameBg: "Созопол",
        nameEn: "Sozopol",
        slug: "sozopol",
        lat: 42.4181,
        lng: 27.6953,
        districts: [
          {
            nameBg: "Стар град",
            nameEn: "Old Town",
            slug: "star-grad",
            lat: 42.4189,
            lng: 27.6961,
          },
          {
            nameBg: "Хармани",
            nameEn: "Harmani",
            slug: "harmani",
            lat: 42.4145,
            lng: 27.6902,
          },
        ],
      },
      {
        nameBg: "Несебър",
        nameEn: "Nesebar",
        slug: "nesebar",
        lat: 42.6591,
        lng: 27.7361,
        districts: [
          {
            nameBg: "Слънчев бряг",
            nameEn: "Sunny Beach",
            slug: "slanchev-bryag",
            lat: 42.6931,
            lng: 27.7128,
          },
        ],
      },
    ],
  },
  {
    nameBg: "Благоевград",
    nameEn: "Blagoevgrad",
    slug: "blagoevgrad",
    cities: [
      {
        nameBg: "Банско",
        nameEn: "Bansko",
        slug: "bansko",
        lat: 41.8383,
        lng: 23.4885,
        districts: [
          {
            nameBg: "Център",
            nameEn: "Centre",
            slug: "centar",
            lat: 41.8383,
            lng: 23.4885,
          },
          {
            nameBg: "Грамадето",
            nameEn: "Gramadeto",
            slug: "gramadeto",
            lat: 41.8264,
            lng: 23.4802,
          },
        ],
      },
    ],
  },
  {
    nameBg: "Велико Търново",
    nameEn: "Veliko Tarnovo",
    slug: "veliko-tarnovo",
    cities: [
      {
        nameBg: "Велико Търново",
        nameEn: "Veliko Tarnovo",
        slug: "veliko-tarnovo",
        lat: 43.0757,
        lng: 25.6172,
        districts: [
          {
            nameBg: "Център",
            nameEn: "Centre",
            slug: "centar",
            lat: 43.0757,
            lng: 25.6172,
          },
          {
            nameBg: "Картала",
            nameEn: "Kartala",
            slug: "kartala",
            lat: 43.0879,
            lng: 25.6295,
          },
        ],
      },
    ],
  },
];

export type SeedFeature = {
  readonly key: string;
  readonly category: "building" | "interior" | "outdoor" | "location";
  readonly nameBg: string;
  readonly nameEn: string;
  readonly icon: string;
};

export const seedFeatures: readonly SeedFeature[] = [
  {
    key: "elevator",
    category: "building",
    nameBg: "Асансьор",
    nameEn: "Elevator",
    icon: "MoveVertical",
  },
  {
    key: "parking",
    category: "building",
    nameBg: "Паркомясто",
    nameEn: "Parking space",
    icon: "CircleParking",
  },
  {
    key: "garage",
    category: "building",
    nameBg: "Гараж",
    nameEn: "Garage",
    icon: "Car",
  },
  {
    key: "security_door",
    category: "building",
    nameBg: "Блиндирана врата",
    nameEn: "Security door",
    icon: "DoorClosed",
  },
  {
    key: "video_surveillance",
    category: "building",
    nameBg: "Видеонаблюдение",
    nameEn: "Video surveillance",
    icon: "Cctv",
  },
  {
    key: "gated_complex",
    category: "building",
    nameBg: "Затворен комплекс",
    nameEn: "Gated complex",
    icon: "Fence",
  },
  {
    key: "new_building",
    category: "building",
    nameBg: "Ново строителство",
    nameEn: "New building",
    icon: "Building2",
  },

  {
    key: "balcony",
    category: "interior",
    nameBg: "Балкон",
    nameEn: "Balcony",
    icon: "Columns2",
  },
  {
    key: "terrace",
    category: "interior",
    nameBg: "Тераса",
    nameEn: "Terrace",
    icon: "Sun",
  },
  {
    key: "basement",
    category: "interior",
    nameBg: "Мазе",
    nameEn: "Basement",
    icon: "Box",
  },
  {
    key: "attic",
    category: "interior",
    nameBg: "Таван",
    nameEn: "Attic",
    icon: "Triangle",
  },
  {
    key: "air_conditioning",
    category: "interior",
    nameBg: "Климатик",
    nameEn: "Air conditioning",
    icon: "Wind",
  },
  {
    key: "fireplace",
    category: "interior",
    nameBg: "Камина",
    nameEn: "Fireplace",
    icon: "Flame",
  },
  {
    key: "fitted_kitchen",
    category: "interior",
    nameBg: "Обзаведена кухня",
    nameEn: "Fitted kitchen",
    icon: "CookingPot",
  },
  {
    key: "underfloor_heating",
    category: "interior",
    nameBg: "Подово отопление",
    nameEn: "Underfloor heating",
    icon: "Thermometer",
  },

  {
    key: "garden",
    category: "outdoor",
    nameBg: "Двор",
    nameEn: "Garden",
    icon: "Trees",
  },
  {
    key: "pool",
    category: "outdoor",
    nameBg: "Басейн",
    nameEn: "Swimming pool",
    icon: "Waves",
  },
  {
    key: "playground",
    category: "outdoor",
    nameBg: "Детска площадка",
    nameEn: "Playground",
    icon: "ToyBrick",
  },

  {
    key: "sea_view",
    category: "location",
    nameBg: "Морска гледка",
    nameEn: "Sea view",
    icon: "Sailboat",
  },
  {
    key: "mountain_view",
    category: "location",
    nameBg: "Планинска гледка",
    nameEn: "Mountain view",
    icon: "Mountain",
  },
  {
    key: "panoramic_view",
    category: "location",
    nameBg: "Панорамна гледка",
    nameEn: "Panoramic view",
    icon: "Eye",
  },
  {
    key: "near_metro",
    category: "location",
    nameBg: "До метростанция",
    nameEn: "Near metro",
    icon: "TrainFront",
  },
  {
    key: "near_park",
    category: "location",
    nameBg: "До парк",
    nameEn: "Near a park",
    icon: "TreePine",
  },
  {
    key: "near_school",
    category: "location",
    nameBg: "До училище",
    nameEn: "Near a school",
    icon: "GraduationCap",
  },
  {
    key: "quiet_street",
    category: "location",
    nameBg: "Тиха улица",
    nameEn: "Quiet street",
    icon: "VolumeX",
  },
];

/** Bulgarian counts rooms including the living room: 2 rooms = 1 bedroom. */
const roomWordBg: Record<number, string> = {
  1: "Едностаен апартамент",
  2: "Двустаен апартамент",
  3: "Тристаен апартамент",
  4: "Четиристаен апартамент",
  5: "Многостаен апартамент",
};

const roomWordEn: Record<number, string> = {
  1: "Studio apartment",
  2: "One-bedroom apartment",
  3: "Two-bedroom apartment",
  4: "Three-bedroom apartment",
  5: "Four-bedroom apartment",
};

export function listingTitle(
  locale: "bg" | "en",
  kind: PropertyKind,
  rooms: number | null,
  districtName: string,
  cityName: string,
): string {
  const place =
    districtName === cityName ? cityName : `${cityName}, ${districtName}`;
  const inWord = locale === "bg" ? "в" : "in";

  if (kind === "apartment" && rooms) {
    const clamped = Math.min(Math.max(rooms, 1), 5);
    const noun = locale === "bg" ? roomWordBg[clamped] : roomWordEn[clamped];
    return `${noun} ${inWord} ${place}`;
  }

  const nouns: Record<PropertyKind, { bg: string; en: string }> = {
    apartment: { bg: "Апартамент", en: "Apartment" },
    house: { bg: "Къща", en: "House" },
    house_floor: { bg: "Етаж от къща", en: "House floor" },
    land: { bg: "Парцел", en: "Land plot" },
    office: { bg: "Офис", en: "Office" },
    retail: { bg: "Магазин", en: "Shop" },
    industrial: { bg: "Индустриален имот", en: "Industrial property" },
    garage: { bg: "Гараж", en: "Garage" },
    hotel: { bg: "Хотел", en: "Hotel" },
    agricultural: { bg: "Земеделска земя", en: "Agricultural land" },
  };

  return `${nouns[kind][locale]} ${inWord} ${place}`;
}

const openingBg = [
  "Предлагаме на вниманието ви светъл имот в добре поддържана сграда.",
  "Ексклузивно от нашата агенция — имот с отлично разпределение и завършек.",
  "Търсите спокойствие на крачки от центъра? Този имот отговаря на очакванията.",
  "Рядко предлагана възможност в един от най-търсените райони.",
];

const openingEn = [
  "A bright property in a well-maintained building.",
  "Exclusive to our agency — an excellent layout with quality finishing.",
  "Looking for calm a short walk from the centre? This one delivers.",
  "A rarely available opportunity in one of the most sought-after areas.",
];

const bodyBg = [
  "Разпределението включва просторна дневна с трапезария, функционална кухня и добре оразмерени спални.",
  "Помещенията са с южно изложение, което осигурява естествена светлина през целия ден.",
  "Сградата разполага с поддържани общи части и надеждна система за достъп.",
  "Довършителните работи са изпълнени с качествени материали, готово за нанасяне състояние.",
];

const bodyEn = [
  "The layout offers a spacious living and dining area, a functional kitchen and well-proportioned bedrooms.",
  "Rooms face south, which keeps them naturally lit throughout the day.",
  "The building has well-kept common areas and a reliable access system.",
  "Finishing works were carried out with quality materials and the property is move-in ready.",
];

const closingBg = [
  "Транспортните връзки са отлични, а наблизо има магазини, училище и зелени площи.",
  "Свържете се с нас за оглед — организираме посещения и в извънработно време.",
  "Разполагаме с пълната документация по имота и съдействаме при банково финансиране.",
];

const closingEn = [
  "Transport links are excellent, with shops, a school and green space nearby.",
  "Get in touch to arrange a viewing — we can also accommodate evenings.",
  "We hold the full documentation for the property and assist with mortgage financing.",
];

export function listingDescription(locale: "bg" | "en", index: number): string {
  const pick = <T>(pool: readonly T[], offset: number): T =>
    pool[(index + offset) % pool.length]!;
  const parts =
    locale === "bg"
      ? [
          pick(openingBg, 0),
          pick(bodyBg, 1),
          pick(bodyBg, 3),
          pick(closingBg, 2),
        ]
      : [
          pick(openingEn, 0),
          pick(bodyEn, 1),
          pick(bodyEn, 3),
          pick(closingEn, 2),
        ];
  return parts.join(" ");
}

/**
 * Deterministic PRNG so that `npm run db:seed` produces byte-identical demo
 * data on every machine — which makes screenshots and e2e assertions stable.
 */
export function createRandom(seed: number) {
  let state = seed >>> 0;
  return function random(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
