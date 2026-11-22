import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { serverEnv } from '@/env';
import { photoKeys, submissionKeyPrefix } from '@/features/submissions/photos';
import { privateStorage, isPrivateStorageConfigured } from '@/server/adapters/storage';
import {
  deleteSubmissionRow,
  listStaleSubmissions,
  listUnpurgedPhotosOfReviewed,
  markSubmissionPhotosPurged,
} from '@/server/repositories/submissions';

/**
 * Daily retention sweep for property submissions.
 *
 * - `incomplete` (started, never sent) after 24 hours: row and files deleted.
 * - `rejected` and `spam` after 30 days: row and files deleted.
 * - `approved` after 30 days: the private photo copies are deleted (the public
 *   listing has its own); the row stays, because it is the record of who
 *   offered the property and how to reach them.
 *
 * Triggered by Vercel Cron (`vercel.json`), which sends
 * `Authorization: Bearer $CRON_SECRET`. On a VPS, call it from cron with the
 * same header. Without `CRON_SECRET` the route refuses to run.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DAY = 24 * 60 * 60 * 1000;

function authorised(request: NextRequest): boolean {
  const secret = serverEnv.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function purgeSubmissions(ids: readonly { id: string }[]): Promise<number> {
  let removed = 0;
  for (const { id } of ids) {
    try {
      // By prefix, so uploads abandoned before they had a row go too.
      await privateStorage().removePrefix(submissionKeyPrefix(id));
    } catch (error) {
      console.error('[cleanup] could not delete files of submission', id, error);
      continue;
    }
    await deleteSubmissionRow(id);
    removed += 1;
  }
  return removed;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isPrivateStorageConfigured()) return NextResponse.json({ skipped: 'no private storage' });

  const now = Date.now();
  const abandoned = await listStaleSubmissions(['incomplete'], new Date(now - DAY));
  const closed = await listStaleSubmissions(['rejected', 'spam'], new Date(now - 30 * DAY));

  const removedAbandoned = await purgeSubmissions(abandoned);
  const removedClosed = await purgeSubmissions(closed);

  const approvedPhotos = await listUnpurgedPhotosOfReviewed(new Date(now - 30 * DAY));
  await privateStorage().remove(approvedPhotos.flatMap(photoKeys));
  await markSubmissionPhotosPurged(approvedPhotos.map((photo) => photo.id));

  const result = {
    abandoned: removedAbandoned,
    closed: removedClosed,
    approvedPhotosPurged: approvedPhotos.length,
  };
  console.info('[cleanup] submissions', result);
  return NextResponse.json(result);
}
