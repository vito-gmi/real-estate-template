import { clientEnv } from '@/env';

/**
 * Content-Security-Policy construction.
 *
 * Two profiles exist, and the difference between them is a deliberate trade-off
 * rather than an oversight:
 *
 * - `nonce` — used for `/admin`. Those pages are dynamically rendered anyway, so
 *   a per-request nonce is available and the policy can be as strict as it gets:
 *   `'nonce-…' 'strict-dynamic'`, no inline execution of any kind. This is the
 *   surface where a successful injection would be most damaging, so it gets the
 *   strongest policy.
 *
 * - `static` — used for the public site. A nonce is impossible here: nonces are
 *   stamped in during server rendering, and these pages are prerendered once and
 *   served from the CDN, so every visitor would receive the same value — which
 *   is no better than none. React's streaming bootstrap is delivered as inline
 *   `<script>` blocks, so `'unsafe-inline'` is required for the page to hydrate
 *   at all. Choosing a nonce instead would mean rendering every property page on
 *   every request, trading the site's core performance and availability property
 *   for a policy that is weaker than it looks.
 *
 *   What compensates on those pages: the app never renders user-supplied HTML
 *   (React escapes everything, and there is no `dangerouslySetInnerHTML` outside
 *   typed JSON-LD), while `object-src 'none'`, `base-uri 'self'`,
 *   `form-action 'self'` and `frame-ancestors 'none'` close the injection
 *   escalation paths that matter most.
 */

export type CspProfile = 'static' | 'nonce';

function mediaOrigin(): string | null {
  const base = clientEnv.NEXT_PUBLIC_MEDIA_BASE_URL;
  if (!base.startsWith('http')) return null;
  return new URL(base).origin;
}

function mapOrigin(): string {
  return new URL(clientEnv.NEXT_PUBLIC_MAP_STYLE_URL).origin;
}

export function buildCsp(profile: CspProfile, nonce?: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  const media = mediaOrigin();
  const map = mapOrigin();

  const scriptSrc =
    profile === 'nonce' && nonce
      ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]
      : ["'self'", "'unsafe-inline'"];

  if (isDev) {
    // React reconstructs server stack traces in the browser using eval.
    scriptSrc.push("'unsafe-eval'");
  }

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': scriptSrc,
    // Next.js and MapLibre both inject inline style attributes. Style injection
    // is not an XSS vector on its own, so this is the pragmatic trade-off.
    'style-src': ["'self'", "'unsafe-inline'"],
    // Sprites and Natural Earth rasters are fetched as images; vector tiles use connect-src.
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      map,
      'https://*.openfreemap.org',
      ...(media ? [media] : []),
    ],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      map,
      'https://*.openfreemap.org',
      'https://*.ingest.sentry.io',
      'https://*.sentry.io',
      ...(media ? [media] : []),
    ],
    'worker-src': ["'self'", 'blob:'],
    'frame-src': ["'self'", 'https://www.youtube-nocookie.com', 'https://player.vimeo.com'],
    'media-src': ["'self'", ...(media ? [media] : [])],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };

  const serialized = Object.entries(directives)
    .map(([directive, values]) => `${directive} ${[...new Set(values)].join(' ')}`)
    .join('; ');

  return isDev ? serialized : `${serialized}; upgrade-insecure-requests`;
}

/**
 * Headers that are identical for every response. Kept here rather than in
 * `next.config.ts` so that all security headers live in one file.
 */
export const staticSecurityHeaders: ReadonlyArray<readonly [string, string]> = [
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['X-Frame-Options', 'DENY'],
  ['X-DNS-Prefetch-Control', 'on'],
  [
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()',
  ],
  ['Cross-Origin-Opener-Policy', 'same-origin'],
];

/** HSTS is only meaningful over TLS, so it is applied outside development. */
export const hstsHeader = ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'] as const;
