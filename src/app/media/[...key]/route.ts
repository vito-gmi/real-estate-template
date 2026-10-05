import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, normalize, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import type { NextRequest } from 'next/server';
import { serverEnv } from '@/env';

/**
 * Serves objects for the local storage driver.
 *
 * Production points `NEXT_PUBLIC_MEDIA_BASE_URL` at the bucket's own domain, so
 * this route never runs there. It exists so `npm run dev` needs nothing but
 * Node and Postgres.
 */

const CONTENT_TYPES: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (serverEnv.STORAGE_DRIVER !== 'local') {
    return new Response('Not found', { status: 404 });
  }

  const { key } = await params;
  // The bundler cannot statically scope a cwd-relative path; this route only
  // ever runs with the local driver, so tracing the whole tree is unnecessary.
  const root = resolve(/* turbopackIgnore: true */ process.cwd(), serverEnv.LOCAL_STORAGE_DIR);
  const target = resolve(root, normalize(join(...key)));

  // Path traversal guard: a crafted `..` segment must not escape the root.
  if (target !== root && !target.startsWith(root + sep)) {
    return new Response('Forbidden', { status: 403 });
  }

  let size: number;
  try {
    const stats = await stat(target);
    if (!stats.isFile()) return new Response('Not found', { status: 404 });
    size = stats.size;
  } catch {
    return new Response('Not found', { status: 404 });
  }

  const extension = target.split('.').pop()?.toLowerCase() ?? '';
  const stream = Readable.toWeb(createReadStream(target)) as ReadableStream;

  return new Response(stream, {
    headers: {
      'content-type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
      'content-length': String(size),
      // Keys are content-addressed, so the bytes behind one can never change.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
