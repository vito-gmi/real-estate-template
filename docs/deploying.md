# Deploying

## Managed path (default): Vercel + Neon + Cloudflare R2

1. Create a Neon project in `eu-central-1`. Copy the **pooled** connection string into `DATABASE_URL`.
2. Create an R2 bucket in the EU jurisdiction. Set `STORAGE_DRIVER=s3` and the `S3_*` variables from `.env.example`. Point a hostname (`images.yourdomain.bg`) at the bucket.
3. Create an Upstash Redis database (EU). Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — login rate limits are not safe on a multi-instance deploy without this.
4. Click **Deploy** on the README button, or `vercel git connect`. Pin functions to `fra1` (`vercel.json` already does).
5. Set every variable from `.env.example`. Generate secrets with `openssl rand -base64 48`.
6. Run migrations and seed as a release command, or from your laptop against the pooled URL:

   ```bash
   npm run db:migrate
   npm run db:seed          # demo data, skip in production
   npm run admin:create     # first staff user
   ```

7. In the Vercel Firewall dashboard, recreate the rules documented in `docs/waf.rules.json`.
8. Optional: set `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`. The browser SDK loads only after cookie consent.

Hobby is non-commercial. An agency site needs Pro.

## Self-host path: Docker Compose + Caddy

```bash
cp .env.example .env.local
# fill AUTH_SECRET, IP_HASH_SALT, PREVIEW_TOKEN_SECRET
docker compose --profile selfhost up --build
```

Postgres, the Next.js app (standalone output) and Caddy (automatic HTTPS) come up together. Point `SITE_DOMAIN` at your hostname. Storage defaults to a local volume; set `STORAGE_DRIVER=s3` to use R2 or MinIO without touching application code.

After the first boot:

```bash
docker compose --profile selfhost exec app node --import tsx/esm src/server/db/migrate.ts
docker compose --profile selfhost exec app node --conditions=react-server --import tsx/esm scripts/create-admin.ts
```

## Environment

Every variable is declared in `src/env.ts` and documented in `.env.example`. A missing or malformed value fails at process start, not three layers into a request.
