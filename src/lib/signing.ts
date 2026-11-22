import { createHmac, timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/env';

/**
 * Short-lived signed tokens.
 *
 * Used for things that must be capability-based rather than session-based:
 * local upload URLs (so the endpoint cannot be used to write arbitrary paths),
 * draft-preview links (so an agent can show an unpublished listing to an
 * owner who has no account), and the handle a visitor holds on the property
 * submission they are filling in.
 *
 * The payload is visible but not forgeable, and every token carries an expiry.
 */

export type SignedPurpose = 'upload' | 'preview' | 'submission';

const SECRETS: Record<SignedPurpose, () => string> = {
  upload: () => serverEnv.AUTH_SECRET,
  preview: () => serverEnv.PREVIEW_TOKEN_SECRET,
  // Lets an anonymous visitor keep adding photos to the submission they
  // started, and nothing else. The purpose is part of the MAC, so this token
  // is useless as an upload or preview token even with the same secret.
  submission: () => serverEnv.AUTH_SECRET,
};

/**
 * What a local-driver upload token is bound to. Public keys sign as the bare
 * key (unchanged, so existing tokens stay valid); private keys carry a prefix,
 * so a token for the public directory cannot write into the private one.
 */
export function localUploadSubject(bucket: 'public' | 'private', key: string): string {
  return bucket === 'private' ? `private:${key}` : key;
}

function sign(purpose: SignedPurpose, payload: string): string {
  return createHmac('sha256', SECRETS[purpose]()).update(`${purpose}:${payload}`).digest('base64url');
}

export function createSignedToken(
  purpose: SignedPurpose,
  subject: string,
  ttlSeconds: number,
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${subject}.${expiresAt}`;
  return `${Buffer.from(payload).toString('base64url')}.${sign(purpose, payload)}`;
}

export function verifySignedToken(purpose: SignedPurpose, token: string): string | null {
  const separator = token.lastIndexOf('.');
  if (separator === -1) return null;

  const encodedPayload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const expected = sign(purpose, payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  // Constant-time comparison: a length check first, because timingSafeEqual
  // throws on mismatched lengths and that itself would leak information.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const lastDot = payload.lastIndexOf('.');
  const subject = payload.slice(0, lastDot);
  const expiresAt = Number(payload.slice(lastDot + 1));

  if (!Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now()) return null;
  return subject;
}
