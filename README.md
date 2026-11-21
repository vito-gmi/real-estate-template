# Estate Template

A production-ready, bilingual (Bulgarian / English) real-estate listings platform — and a reusable open-source template. The public site is read-heavy and cached at the edge; a hardened admin console is the only write path.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_ORG/estate-template&env=DATABASE_URL,AUTH_SECRET,NEXT_PUBLIC_SITE_URL,IP_HASH_SALT,PREVIEW_TOKEN_SECRET&envDescription=See%20.env.example%20for%20the%20full%20list&project-name=estate-template&repository-name=estate-template)

Replace `YOUR_ORG/estate-template` in the button URL with this repository after you push it.

## What you get

- Listings for sale and rent across apartments, houses, land, offices and the rest of the Bulgarian market vocabulary
- Faceted search with keyset pagination, bilingual URLs, map pin, mortgage calculator, similar listings
- Anonymous, device-local favourites, compare view, shareable encoded-ID links
- Admin console: Argon2id + mandatory TOTP, listing CRUD, drag-and-drop R2 uploads with precomputed AVIF/WebP derivatives, inquiry inbox, taxonomy, audit log, CSV/JSON import/export, draft preview links
- SEO: `hreflang`, JSON-LD (`RealEstateListing` / `Offer` / `BreadcrumbList`), split sitemaps, RSS, OG images
- Designed to stay flat from 5 to 50,000 listings

## Quick start

```bash
cp .env.example .env.local
# AUTH_SECRET must be ≥ 32 characters:  openssl rand -base64 48
npm install
npm run docker:db          # Postgres 17 on localhost:5433
npm run db:migrate
npm run db:seed            # 60 bilingual demo listings
npm run admin:create       # first staff user
npm run dev
```

Open [http://localhost:3000/bg](http://localhost:3000/bg) and [http://localhost:3000/en](http://localhost:3000/en). Admin is at `/bg/admin`.

## Rebrand

1. Edit `src/config/site.ts` — name, offices, currency, feature flags.
2. Add your logo: put the files in `public/brand/`, then set `logo` (e.g. `{ src: '/brand/logo.svg', width: 180, height: 40 }`) and `favicon` (a square `.png`, `.jpg` or `.svg`) in `src/config/site.ts`. Left at `null`, the site shows a text wordmark built from `name`.
3. Edit `src/app/globals.css` — design tokens in the `@theme` block.
4. Translate or rewrite `messages/bg.json` and `messages/en.json`.

Nothing agency-specific should be hardcoded in a component.

## Scripts

| Command                               | Purpose                        |
| ------------------------------------- | ------------------------------ |
| `npm run dev`                         | Next.js dev server             |
| `npm run lint` / `typecheck` / `test` | CI static checks               |
| `npm run test:e2e`                    | Playwright smoke + axe         |
| `npm run bench:search`                | p95 assertion against 50k rows |
| `npm run db:seed:bench`               | load 50k synthetic listings    |
| `./scripts/backup.sh`                 | gzipped Postgres dump          |

## Docs

- [Architecture](docs/architecture.md)
- [Deploying](docs/deploying.md) (Vercel + Neon + R2, or Docker Compose + Caddy)
- [Adding a property type](docs/adding-a-property-type.md)
- [Adding a locale](docs/adding-a-locale.md)
- [Security](docs/security.md)
- [Backups](docs/backups.md)

## License

[MIT](LICENSE)
