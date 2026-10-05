import { NextResponse } from 'next/server';

/**
 * Beacon sink for Core Web Vitals.
 *
 * Kept tiny and unauthenticated: the payload is a few numbers, not PII. Production
 * deployments typically forward this to Vercel Analytics; locally it is a no-op
 * success so `sendBeacon` does not 404.
 */
export async function POST() {
  return new NextResponse(null, { status: 204 });
}
