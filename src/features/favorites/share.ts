/**
 * Compact encoding for shareable favourite lists.
 *
 * A comma-separated list of UUIDs costs 37 characters each, which turns a
 * ten-property shortlist into a link that messaging apps truncate. Packing the
 * raw 16 bytes and base64url-encoding them costs 22 characters instead, so the
 * link survives being pasted into a chat.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array | null {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  try {
    if (typeof atob === 'function') {
      const binary = atob(padded);
      return Uint8Array.from(binary, (char) => char.charCodeAt(0));
    }
    return new Uint8Array(Buffer.from(padded, 'base64'));
  } catch {
    return null;
  }
}

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replaceAll('-', '');
  const bytes = new Uint8Array(16);
  for (let index = 0; index < 16; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToUuid(bytes: Uint8Array, offset: number): string {
  let hex = '';
  for (let index = offset; index < offset + 16; index += 1) {
    hex += bytes[index]!.toString(16).padStart(2, '0');
  }
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

export function encodeFavoriteIds(ids: readonly string[]): string {
  const valid = ids.filter((id) => UUID_PATTERN.test(id));
  const bytes = new Uint8Array(valid.length * 16);
  valid.forEach((id, index) => bytes.set(uuidToBytes(id), index * 16));
  return bytesToBase64Url(bytes);
}

/** Returns an empty list for anything malformed — a broken link shows an empty page, not an error. */
export function decodeFavoriteIds(encoded: string | undefined | null): string[] {
  if (!encoded) return [];
  const bytes = base64UrlToBytes(encoded);
  if (!bytes || bytes.length === 0 || bytes.length % 16 !== 0) return [];

  const ids: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    ids.push(bytesToUuid(bytes, offset));
  }
  return ids;
}
