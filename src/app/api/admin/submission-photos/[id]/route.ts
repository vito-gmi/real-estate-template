import type { NextRequest } from 'next/server';
import { privateStorage } from '@/server/adapters/storage';
import { currentStaffOrNull } from '@/server/auth/session';
import { getSubmissionPhoto } from '@/server/repositories/submissions';

/**
 * Serves a submission photo to signed-in staff.
 *
 * The objects sit in the private bucket and are never given a public URL; the
 * reviewer's browser gets them through here instead. Looked up by photo id,
 * so the storage key never reaches the client. `?size=full` returns the
 * normalised JPEG, anything else the thumbnail.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentStaffOrNull('agent');
  if (!user) return new Response('Forbidden', { status: 403 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response('Not found', { status: 404 });

  const photo = await getSubmissionPhoto(id);
  if (!photo || photo.purgedAt) return new Response('Not found', { status: 404 });

  const full = request.nextUrl.searchParams.get('size') === 'full';
  let body: Buffer;
  try {
    body = await privateStorage().get(full ? photo.storageKey : photo.thumbKey);
  } catch {
    return new Response('Not found', { status: 404 });
  }

  return new Response(new Uint8Array(body), {
    headers: {
      'content-type': full ? 'image/jpeg' : 'image/webp',
      'content-length': String(body.byteLength),
      // Private: never stored by a CDN or a shared proxy.
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  });
}
