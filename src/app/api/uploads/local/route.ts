import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, normalize, resolve, sep } from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { serverEnv } from '@/env';
import { MAX_UPLOAD_BYTES, isAcceptedImageType } from '@/lib/domain/media';
import { localUploadSubject, verifySignedToken } from '@/lib/signing';

/**
 * Receives direct uploads for the local storage driver.
 *
 * Production uses a real pre-signed bucket URL and never touches this route. It
 * exists so `npm run dev` needs no cloud credentials, and it enforces the same
 * guarantees the bucket would: the key must carry a valid short-lived signature,
 * the content type must be an image, and the size is capped.
 *
 * `bucket=private` writes to the private directory used for unreviewed visitor
 * uploads. The bucket is part of the signed subject, so a token issued for one
 * directory cannot be replayed against the other.
 */
export async function PUT(request: NextRequest) {
  if (serverEnv.STORAGE_DRIVER !== 'local') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const key = request.nextUrl.searchParams.get('key');
  const token = request.nextUrl.searchParams.get('token');
  const bucket = request.nextUrl.searchParams.get('bucket') === 'private' ? 'private' : 'public';
  if (!key || !token) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  // The signature binds the token to this exact key, so a valid token for one
  // upload cannot be replayed to write somewhere else.
  if (verifySignedToken('upload', token) !== localUploadSubject(bucket, key)) {
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

  const dir = bucket === 'private' ? serverEnv.LOCAL_PRIVATE_STORAGE_DIR : serverEnv.LOCAL_STORAGE_DIR;
  const root = resolve(/* turbopackIgnore: true */ process.cwd(), dir);
  const target = resolve(root, normalize(key));
  if (target !== root && !target.startsWith(root + sep)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, body);

  return NextResponse.json({ ok: true });
}
