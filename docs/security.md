# Security

## Headers

`src/proxy.ts` applies, on every HTML response:

- `Content-Security-Policy` — nonce + `strict-dynamic` on `/admin` (dynamic); `'unsafe-inline'` scripts on the public ISR site, with the trade-off documented in `src/lib/security/headers.ts`
- `Strict-Transport-Security` (`max-age=63072000; includeSubDomains; preload`) on HTTPS
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` disabling camera, mic, payment, USB
- `Cross-Origin-Opener-Policy: same-origin`

`vercel.json` repeats the static headers as defence in depth for responses that skip proxy.

## Auth

- Argon2id (19 MiB, 2 iterations) via `@node-rs/argon2`
- TOTP 2FA mandatory before any admin page (`requireStaff`)
- Session cookies: `httpOnly`, `Secure` in production, `SameSite=Lax`
- Per-IP and per-account sliding-window limits (Upstash Redis)
- Exponential account lockout from the 5th consecutive failure (1, 2, 4, … 32 minutes)

## Uploads

The app never proxies original bytes. The browser PUTs to a short-lived presigned URL; a server action then runs `sharp` (MIME sniff, size cap, AVIF/WebP derivatives). Stored originals and derivatives carry no EXIF/GPS metadata.

Visitor uploads (property submissions) go to a separate **private** bucket, never the public media bucket. Each presigned key is issued for one submission and bound to it by a signed token; the server decodes and re-encodes every file, strips metadata, and only staff can view the result (`/api/admin/submission-photos/[id]`, session-checked). Approval copies photos into public media through the normal pipeline. Abuse controls: honeypot, per-address and per-email rate limits, a photo cap per submission, Cloudflare Turnstile when configured, and a daily cleanup of abandoned uploads.

## Personal data

Visitor IPs are stored only as `sha256(salt + ip)` prefixes. Cookie consent (`estate:cookie-consent:v1`) gates Sentry and Web Vitals beacons. Inquiry retention is described on the privacy page (`src/content/legal.ts`).

## WAF

Recreate the rules in `docs/waf.rules.json` in the Vercel Firewall dashboard. They challenge bursts on `/admin/login` and inquiry POSTs, and deny well-known scanner user agents.

## Accessibility

Playwright + axe run in CI (`tests/e2e/public.spec.ts`). Serious and critical violations fail the build. Manual WCAG 2.2 AA checks that axe cannot see (focus order in the gallery, reduced-motion) live in the public components (`prefers-reduced-motion` is honoured in `globals.css`).
