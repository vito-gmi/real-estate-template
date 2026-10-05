import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, normalize, resolve, sep } from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { serverEnv } from '@/env';
import { MAX_UPLOAD_BYTES, isAcceptedImageType } from '@/lib/domain/media';
import { verifySignedToken } from '@/lib/signing';

/**
 * Receives direct uploads for the local storage driver.
 *
 * Production uses a real pre-signed bucket URL and never touches this route. It
 * exists so `npm run dev` needs no cloud credentials, and it enforces the same
 * guarantees the bucket would: the key must carry a valid short-lived signature,
 * the content type must be an image, and the size is capped.
 */
export async function PUT(request: NextRequest) {
  if (serverEnv.STORAGE_DRIVER !== 'local') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const key = request.nextUrl.searchParams.get('key');
  const token = request.nextUrl.searchParams.get('token');
  if (!key || !token) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  // The signature binds the token to this exact key, so a valid token for one
  // upload cannot be replayed to write somewhere else.
  if (verifySignedToken('upload', token) !== key) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 403 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!isAcceptedImageType(contentType)) {
    return NextResponse.json({ error: 'unsupported_type' }, { status: 415 });
  }

  const body = Buffer.from(await request.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'invalid_size' }, { status: 413 });
  }

  const root = resolve(/* turbopackIgnore: true */ process.cwd(), serverEnv.LOCAL_STORAGE_DIR);
  const target = resolve(root, normalize(key));
  if (target !== root && !target.startsWith(root + sep)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, body);

  return NextResponse.json({ ok: true });
}
