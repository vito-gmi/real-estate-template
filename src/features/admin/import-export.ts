import { listingFormSchema, type ListingFormInput, type ListingFormValues } from './listing-schema';

/**
 * Listing import/export serialisation.
 *
 * JSON is the canonical format (round-trips every field). CSV is a flattened
 * subset so an agent can bulk-edit in a spreadsheet and send the file back.
 */

export type ExportRecord = ListingFormInput & {
  readonly id?: string;
  readonly reference?: number;
};

const CSV_COLUMNS = [
  'reference',
  'dealType',
  'propertyKind',
  'status',
  'price',
  'currency',
  'showPrice',
  'area',
  'landArea',
  'rooms',
  'bedrooms',
  'bathrooms',
  'floor',
  'floorsTotal',
  'yearBuilt',
  'locationId',
  'address',
  'titleBg',
  'titleEn',
  'descriptionBg',
  'descriptionEn',
  'featureKeys',
] as const;

export function recordsToJson(records: readonly ExportRecord[]): string {
  return `${JSON.stringify({ listings: records }, null, 2)}\n`;
}

export function recordsToCsv(records: readonly ExportRecord[]): string {
  const header = CSV_COLUMNS.join(',');
  const lines = records.map((record) =>
    CSV_COLUMNS.map((column) => {
      const value = record[column as keyof ExportRecord];
      return csvCell(value);
    }).join(','),
  );
  return [header, ...lines].join('\n');
}

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return '';
  const text = Array.isArray(value) ? value.join('|') : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function parseImportPayload(raw: string, filename: string): ListingFormValues[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (filename.endsWith('.csv') || looksLikeCsv(trimmed)) {
    return parseCsv(trimmed);
  }
  return parseJson(trimmed);
}

function looksLikeCsv(raw: string): boolean {
  const first = raw.split('\n')[0] ?? '';
  // A minified JSON array also has both keys on its first line.
  return first.includes('dealType') && first.includes('titleBg') && !/^[[{]/.test(first.trim());
}

function parseJson(raw: string): ListingFormValues[] {
  const parsed: unknown = JSON.parse(raw);
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && 'listings' in parsed
      ? (parsed as { listings: unknown }).listings
      : null;

  if (!Array.isArray(list)) {
    throw new Error('JSON must be an array or `{ "listings": [...] }`.');
  }

  return list.map((item, index) => {
    const withVisibility =
      item && typeof item === 'object' && !('showPrice' in item)
        ? { ...item, showPrice: hasPrice((item as { price?: unknown }).price) }
        : item;
    const result = listingFormSchema.safeParse(withVisibility);
    if (!result.success) {
      throw new Error(`Listing ${index + 1} is invalid: ${result.error.issues[0]?.message ?? 'unknown'}`);
    }
    return result.data;
  });
}

function parseCsv(raw: string): ListingFormValues[] {
  const rows = splitCsv(raw);
  const header = rows[0];
  if (!header) return [];

  const index = new Map(header.map((name, i) => [name.trim(), i]));
  const required = ['dealType', 'propertyKind', 'locationId', 'titleBg', 'titleEn'];
  for (const name of required) {
    if (!index.has(name)) throw new Error(`CSV is missing column "${name}".`);
  }

  return rows.slice(1).filter((row) => row.some((cell) => cell.trim())).map((row, indexNumber) => {
    const get = (name: string) => row[index.get(name) ?? -1]?.trim() ?? '';
    const features = get('featureKeys');
    const price = get('price');
    const input = {
      dealType: get('dealType'),
      propertyKind: get('propertyKind'),
      status: get('status') || 'draft',
      price: price || undefined,
      currency: get('currency') || 'EUR',
      showPrice: get('showPrice') ? parseFlag(get('showPrice')) : hasPrice(price),
      area: get('area') || undefined,
      landArea: get('landArea') || undefined,
      rooms: get('rooms') || undefined,
      bedrooms: get('bedrooms') || undefined,
      bathrooms: get('bathrooms') || undefined,
      floor: get('floor') || undefined,
      floorsTotal: get('floorsTotal') || undefined,
      yearBuilt: get('yearBuilt') || undefined,
      locationId: get('locationId'),
      address: get('address') || undefined,
      hideExactAddress: true,
      isFeatured: false,
      isExclusive: false,
      titleBg: get('titleBg'),
      titleEn: get('titleEn'),
      descriptionBg: get('descriptionBg'),
      descriptionEn: get('descriptionEn'),
      featureKeys: features ? features.split('|').filter(Boolean) : [],
    };
    const result = listingFormSchema.safeParse(input);
    if (!result.success) {
      throw new Error(`Row ${indexNumber + 2} is invalid: ${result.error.issues[0]?.message ?? 'unknown'}`);
    }
    return result.data;
  });
}

/**
 * Files exported before prices could be hidden have no `showPrice` (and a
 * spreadsheet may leave the cell blank). Those prices were public, so they stay
 * public rather than all turning into "price on request" on re-import.
 */
function hasPrice(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function parseFlag(value: string): boolean {
  return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
}

/** RFC 4180 splitter that understands quoted cells. */
export function splitCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i]!;
    if (quoted) {
      if (char === '"' && raw[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell.replace(/\r$/, ''));
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}
