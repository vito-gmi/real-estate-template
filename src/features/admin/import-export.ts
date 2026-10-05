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
  return first.includes('dealType') && first.includes('titleBg') && !first.trim().startsWith('{');
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
    const result = listingFormSchema.safeParse(item);
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
  const required = ['dealType', 'propertyKind', 'price', 'locationId', 'titleBg', 'titleEn'];
  for (const name of required) {
    if (!index.has(name)) throw new Error(`CSV is missing column "${name}".`);
  }

  return rows.slice(1).filter((row) => row.some((cell) => cell.trim())).map((row, indexNumber) => {
    const get = (name: string) => row[index.get(name) ?? -1]?.trim() ?? '';
    const features = get('featureKeys');
    const input = {
      dealType: get('dealType'),
      propertyKind: get('propertyKind'),
      status: get('status') || 'draft',
      price: get('price'),
      currency: get('currency') || 'EUR',
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
