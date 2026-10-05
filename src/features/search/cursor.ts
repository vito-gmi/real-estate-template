import type { SortOption } from '@/lib/domain/enums';

/**
 * Keyset pagination cursor.
 *
 * `OFFSET 20000` forces Postgres to walk and discard twenty thousand rows, so
 * deep pages get slower the larger the catalogue grows. A cursor that carries
 * the last row's sort key and id lets every page be a single index seek instead,
 * which is what makes page 1 and page 500 cost the same.
 */
export type SearchCursor = {
  /** The sort key of the last row on the previous page, as a string. */
  readonly value: string;
  readonly id: string;
  /** Guards against a cursor being reused after the sort order changed. */
  readonly sort: SortOption;
};

const SEPARATOR = '~';

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function encodeCursor(cursor: SearchCursor): string {
  return toBase64Url([cursor.sort, cursor.value, cursor.id].join(SEPARATOR));
}

/** Returns `undefined` for anything malformed — a bad cursor shows page one. */
export function decodeCursor(raw: string | undefined, expectedSort: SortOption): SearchCursor | undefined {
  if (!raw) return undefined;

  let decoded: string;
  try {
    decoded = fromBase64Url(raw);
  } catch {
    return undefined;
  }

  const separatorIndex = decoded.indexOf(SEPARATOR);
  if (separatorIndex === -1) return undefined;

  const sort = decoded.slice(0, separatorIndex);
  const rest = decoded.slice(separatorIndex + 1);
  const lastSeparator = rest.lastIndexOf(SEPARATOR);
  if (lastSeparator === -1) return undefined;

  const value = rest.slice(0, lastSeparator);
  const id = rest.slice(lastSeparator + 1);

  if (sort !== expectedSort) return undefined;
  if (!value || !isUuid(id)) return undefined;

  return { sort: expectedSort, value, id };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
