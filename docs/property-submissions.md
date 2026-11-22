# Property submissions ("List your property")

Owners can offer a property for sale or rent through a public form. Nothing they send is public: staff review each submission in the admin console and either approve it — which creates a **draft** listing to finish and publish — or decline it.

- Public form: `/bg/predlozhete-imot`, `/en/list-your-property` (`?deal=rent` preselects renting out)
- Entry points: header button, phone menu, a band on the home page, the footer, the contact page
- Review queue: **Admin → Submissions**
- On/off switch and options: **Admin → Settings** (admins only)

## How it works

1. The visitor fills in four sections: the property, details (fields follow the property type and deal, like the admin editor), photos and description, and contact details with GDPR consent.
2. Photos upload while the rest is being typed. Each photo is shrunk in the browser to 2560 px (a 6 MB phone photo becomes ~0.5 MB; EXIF/GPS is dropped on the device), sent straight to the **private** bucket with a presigned URL, then decoded, re-encoded without metadata and thumbnailed on the server. Up to 30 photos, at least 600 px on the shorter side, JPEG/PNG/WebP (iPhones convert HEIC automatically).
3. On submit the server checks the honeypot, rate limits (5 submissions per address and 3 per email per day), Cloudflare Turnstile, then stores the submission as `pending`. The office gets an email with a link to the review page; the visitor gets a confirmation with a reference number.
4. In the console a reviewer picks which photos to keep, chooses the district to file the listing under, and approves. The app creates a draft listing (titles generated in both languages, asking price kept but hidden, exact address hidden, description in the language the owner wrote in) and copies the chosen photos through the normal media pipeline, one per request with a progress bar. The reviewer lands in the listing editor; a panel there shows the owner's contact details.
5. Declining asks for an optional reason. Marking as spam deletes the photos at once. Admins can delete a submission permanently (for data-deletion requests).

Owner emails on approval and on decline are on by default and can be switched off in Settings; the approve and decline dialogs pre-tick the box accordingly and the reviewer can untick it each time.

### Why single photos, not a ZIP/RAR

Phones cannot easily create archives, RAR needs a proprietary extractor the server does not have, unpacking a 50 MB archive in one serverless call is slow and memory-hungry, archives invite zip bombs and path tricks, and one bad file or a dropped connection fails the whole upload. Single photos upload in parallel with per-photo progress, retry and reordering. For large sets the form has an optional "link to more photos or a video" field (Google Drive, Dropbox, WeTransfer, YouTube).

## Data and retention

| Data | Where | Kept |
| --- | --- | --- |
| Submission (property + contact details) | `property_submissions` | Approved: indefinitely (it is the record of who offered the property). Declined / spam: 30 days. Never sent: 24 hours. |
| Photos | private bucket, `submissions/<id>/` | Until 30 days after approval (the listing has its own public copies), or with the submission. |
| Settings | `app_settings` | — |

The daily cleanup job (`/api/cron/cleanup-submissions`) enforces this. The privacy policy (`src/content/legal.ts`) describes it in both languages — adjust the text if you change the periods.

## Setup

The form stays closed — buttons hidden, the page asks visitors to call — until there is a private place for photos. With `STORAGE_DRIVER=local` that is automatic (`LOCAL_PRIVATE_STORAGE_DIR`, default `.storage-private`). With R2 it needs a second bucket. **Admin → Settings → Configuration** shows what is set up.

### 1. Private R2 bucket

A second bucket is free: R2's free allowance (10 GB-month, 1M writes, 10M reads per month, free egress) is per account, not per bucket.

1. Cloudflare dashboard → **R2 Object Storage** → **Create bucket**.
   - Name: e.g. `yourbrand-submissions`.
   - Location: the same jurisdiction as your media bucket (EU).
   - Storage class: Standard.
2. Leave it **private**. In the bucket's **Settings**, do not connect a custom domain and keep the **r2.dev public URL disabled**. This is the whole point of the second bucket: your media bucket is publicly readable through its domain, so unreviewed uploads must not go there.
3. **Settings → CORS policy → Edit**, and paste (use your real hostnames; add `http://localhost:3000` only if you test the s3 driver locally):

   ```json
   [
     {
       "AllowedOrigins": ["https://yourdomain.bg", "https://www.yourdomain.bg"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   Browsers upload photos straight to the bucket, so without this the upload fails with a CORS error.
4. Give the app's API token access. **R2 → Manage API tokens**, edit the token whose keys are in `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`: permission **Object Read & Write**, and if it is limited to specific buckets, add the new one. (Both buckets use the same keys.)
5. Optional safety net: **Settings → Object lifecycle rules → Add rule**, prefix `submissions/`, delete objects after **90 days**. The cleanup job normally deletes them much sooner; this catches anything it misses.
6. In Vercel → Project → **Settings → Environment Variables**, add `S3_PRIVATE_BUCKET=yourbrand-submissions` (Production and Preview) and redeploy.

The Content-Security-Policy already allows uploads to `*.r2.cloudflarestorage.com` when `STORAGE_DRIVER=s3`.

### 2. Cloudflare Turnstile (anti-spam)

Turnstile is free and works for any domain — the domain can stay registered and hosted wherever it is (e.g. SuperHosting); no DNS change or nameserver move is needed.

1. Cloudflare dashboard → **Turnstile** → **Add widget**.
2. Widget name: `List your property`. **Hostnames:** add `yourdomain.bg` and `www.yourdomain.bg` (exact names; wildcards are not supported). Add your `*.vercel.app` production hostname too if you want the form to work there. `localhost` is allowed automatically.
3. Widget mode: **Managed**. Pre-clearance: **No**. Create.
4. Copy the **Site key** into `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the **Secret key** into `TURNSTILE_SECRET_KEY` (Vercel, Production and Preview).
5. Redeploy. The site key is compiled into the page bundle, so it only takes effect after a new build (on Docker: `docker compose --profile selfhost up --build`).

Set both keys or neither — with only one, the check stays off and the server log says so. For local development, Cloudflare's always-pass test keys are listed in `.env.example`.

### 3. Daily cleanup

1. Generate a secret: `openssl rand -hex 32`, and set it as `CRON_SECRET`.
2. **Vercel:** nothing else to do — `vercel.json` schedules the job daily at 03:00 UTC and Vercel sends the secret automatically. Check **Project → Settings → Cron Jobs** after the next deploy.
3. **VPS / Docker:** add to the server's crontab:

   ```cron
   0 3 * * * curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourdomain.bg/api/cron/cleanup-submissions
   ```

### 4. Email

Office notifications go to `MAIL_TO` (falls back to `siteConfig.contact.email`). With `MAIL_DRIVER=console` they are only printed to the server log; set `MAIL_DRIVER=resend`, `RESEND_API_KEY` and a `MAIL_FROM` on a domain verified in Resend.

### 5. Turn it on

**Admin → Settings → Property submissions**: enable *Accept properties from visitors*, choose the minimum number of photos (default 1), and decide whether owners get approval/decline emails. Changes apply immediately (the public pages are revalidated); no redeploy.

## Files

| Concern | Where |
| --- | --- |
| Public page and form | `src/features/submissions/pages/submit-page.tsx`, `components/submission-form.tsx`, `components/photo-uploader.tsx`, `prepare-image.ts` |
| Server actions (public) | `src/features/submissions/actions.ts` |
| Server actions (review) | `src/features/submissions/admin-actions.ts` |
| Validation | `src/features/submissions/schema.ts` |
| Submission → listing | `src/features/submissions/to-listing.ts` |
| Photo sanitising | `src/features/submissions/photos.ts` |
| Emails | `src/features/submissions/emails.ts` (copy in `messages/*.json` → `submitEmail`) |
| Queries | `src/server/repositories/submissions.ts` |
| Tables | `src/server/db/schema/submissions.ts`, `settings.ts` (migration `0005_property_submissions`) |
| Staff photo route | `src/app/api/admin/submission-photos/[id]/route.ts` |
| Cleanup job | `src/app/api/cron/cleanup-submissions/route.ts` |
| Settings | `src/features/settings/*`, `src/app/[locale]/admin/(console)/settings/page.tsx` |
