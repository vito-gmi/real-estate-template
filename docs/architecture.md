# Architecture

Estate Template is a bilingual (Bulgarian / English) property-listings platform. The public site is read-heavy and cached; the only write path is a staff admin console.

## Request flow

1. Cloudflare DNS / WAF terminates TLS and filters obvious abuse.
2. Vercel serves ISR-cached HTML from the edge for almost every public GET.
3. Next.js App Router (Frankfurt `fra1`) renders on cache miss or admin write.
4. Postgres (Neon, `eu-central-1`) is touched only then. Images stream from Cloudflare R2, never through the app.

A database outage therefore serves stale pages instead of 500s — that is a deliberate availability property, not a side effect.

## Layering

```
src/
  app/          thin route adapters: parse input, call a use case, render
  features/     one folder per bounded context
  server/
    db/         schema, migrations, seed
    repositories/   the ONLY place Drizzle queries live
    adapters/   storage, mail
  lib/          formatters, Result, signing, SEO
  config/site.ts    branding and feature flags
```

- **Repository** — SQL stays in `server/repositories/*`. Use cases never import Drizzle.
- **Adapter** — `StorageAdapter` (R2 / S3 / local disk) and `MailAdapter` (Resend / console). Swap them in env, not in feature code.
- **Builder** — `SearchQueryBuilder` composes filter fragments into one query. Pagination is keyset (`published_at, id`), never `OFFSET`.
- **Mapper** — DB rows become view models at the boundary. Hidden addresses never reach the client bundle.
- **Result** — expected failures (`not_found`, `rate_limited`) are values; exceptions are bugs.
- **Zod** — one schema drives the form, the server action, and the TypeScript types.

## Caching

`src/server/cache.ts` tags every public read. Publishing a listing calls `revalidateTag('listings')` with immediate expiry so the agent sees the change on the next request, while the previous HTML remains on the CDN if the origin is down.

## Auth

There are no public accounts. Favourites live in `localStorage`. `better-auth` issues staff sessions (Argon2id, mandatory TOTP, 8-hour cookies). Login is rate-limited per IP and per account, then locked out with exponential backoff.

## Preview links

Drafts are not on the public site. An agent issues a signed token (`PREVIEW_TOKEN_SECRET`, 7-day TTL) that unlocks `/[locale]/imot|property/[slug]?preview=…` for that listing only.
