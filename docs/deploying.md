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

Postgres, the Next.js app (standalone output) and Caddy (automatic HTTPS) run together. Run these steps on the server, in a checkout of this repository, with Docker and Node.js 24 installed.

**1. Settings.** Docker Compose reads `.env` (not `.env.local`) from this folder. Create it before the first start — the database password only takes effect when the database volume is created:

```bash
DOMAIN=estate.example.bg   # your hostname, already pointing at this server
cat > .env <<EOF
SITE_DOMAIN=$DOMAIN
NEXT_PUBLIC_SITE_URL=https://$DOMAIN
AUTH_SECRET=$(openssl rand -base64 48)
IP_HASH_SALT=$(openssl rand -base64 32)
PREVIEW_TOKEN_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
EOF
```

If a secret is missing, the app logs its name at startup (`docker compose logs app`) and every request fails until it is set. `NEXT_PUBLIC_*` values are compiled into the app when the image is built, so after changing one, rebuild with `--build`.

**2. Build and start.**

```bash
docker compose --profile selfhost up -d --build
```

**3. Create the schema and the first admin.** The app image contains only the compiled server, so these run from the checkout, against Postgres on `127.0.0.1:5433` (published to this machine only):

```bash
npm ci
export $(grep POSTGRES_PASSWORD .env)
DATABASE_URL="postgres://estate:$POSTGRES_PASSWORD@127.0.0.1:5433/estate" npm run db:migrate
DATABASE_URL="postgres://estate:$POSTGRES_PASSWORD@127.0.0.1:5433/estate" npm run admin:create
```

Re-run `db:migrate` after every update that adds a migration. Uploads go to a Docker volume by default; set `STORAGE_DRIVER=s3` in `.env` (and add the `S3_*` variables to the `app` service) to use R2 or MinIO instead.

## Environment

Every variable is declared in `src/env.ts` and documented in `.env.example`. A missing or malformed value fails at process start, not three layers into a request.
