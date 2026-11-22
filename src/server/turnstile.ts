import 'server-only';

import { clientEnv, serverEnv } from '@/env';

/**
 * Cloudflare Turnstile — a free, cookie-less captcha.
 *
 * It works for any domain: the site's DNS does not have to be on Cloudflare,
 * only the hostnames have to be listed on the widget. Both keys must be set for
 * it to switch on; with only one, the widget could never produce a token the
 * server accepts (or vice versa), so a half-configured pair counts as off and
 * says so in the server log.
 *
 * Tokens are single-use and expire after five minutes, so the form verifies
 * exactly once, at the final submit.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function isTurnstileEnabled(): boolean {
  const site = Boolean(clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const secret = Boolean(serverEnv.TURNSTILE_SECRET_KEY);
  if (site !== secret) {
    console.warn(
      '[turnstile] Only one of NEXT_PUBLIC_TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY is set; the challenge is OFF.',
    );
  }
  return site && secret;
}

type SiteverifyResponse = {
  readonly success: boolean;
  readonly action?: string;
  readonly hostname?: string;
  readonly 'error-codes'?: readonly string[];
};

/**
 * True when the token is valid, or when Turnstile is not configured.
 *
 * Fails closed: if Cloudflare cannot be reached the submission is refused.
 * The visitor keeps everything they typed and can press Send again.
 */
export async function verifyTurnstile(
  token: string | undefined,
  ip: string,
  expectedAction: string,
): Promise<boolean> {
  if (!isTurnstileEnabled()) return true;
  if (!token) return false;

  const body = new URLSearchParams({
    secret: serverEnv.TURNSTILE_SECRET_KEY ?? '',
    response: token,
  });
  if (ip && ip !== '0.0.0.0') body.set('remoteip', ip);

  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const result = (await response.json()) as SiteverifyResponse;

    if (!result.success) {
      console.warn('[turnstile] rejected', result['error-codes']);
      return false;
    }
    // Cloudflare's test keys return no action; a real token for a different
    // widget action is a token minted for some other form.
    return !result.action || result.action === expectedAction;
  } catch (error) {
    console.error('[turnstile] verification request failed', error);
    return false;
  }
}
