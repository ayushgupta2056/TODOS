# Deploying Glimpse on free tiers

| Piece | Service | Free-tier notes |
|---|---|---|
| Web (Next.js) | Cloudflare Workers via `@opennextjs/cloudflare` | 100k requests/day. Commercial use allowed. Bundle limit 3 MiB gzipped: ours is ~2.4 MiB with the webpack build. |
| DB + Auth + Realtime | Supabase free | 500 MB database, 50k monthly active users, 2 projects. Paused after 7 days of inactivity (see below). |
| Photos | Cloudflare R2 | 10 GB storage, 1M writes and 10M reads a month, **zero egress**. A card is required to *enable* R2, though nothing is charged within the free tier. |
| Face worker | Oracle Cloud Always Free Ampere A1 VM | Up to 4 OCPU + 24 GB RAM. A card is required for identity verification. |
| Email (optional) | Resend free | 3,000 emails a month. |
| Payments (optional) | Razorpay | No monthly fee, per-transaction only. |

> Two sign-ups ask for a card even though they stay free: **R2** and **Oracle**. If that is a blocker, run the
> worker on your laptop and use Supabase Storage's S3 endpoint (1 GB free) instead of R2 for the pilot.

---

## 1. Supabase

1. Create a project (choose the Mumbai region for Indian users).
2. Link and push the migrations:
   ```bash
   cd packages/db
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
3. Auth → URL configuration: set Site URL to `https://<your-domain>`, and add `https://<your-domain>/**` to the redirect URLs.
4. Auth → Providers: email is on by default. For Google, add an OAuth client (Google Cloud console, free) and set `NEXT_PUBLIC_GOOGLE_AUTH=true` on the web app.
5. Auth → Email templates → Magic link: add a link to
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink` so links also work across devices.
6. Note the values the next steps need: the project URL, the `anon` key, the `service_role` key, and the **Session pooler** connection string (for the worker, IPv4-friendly).

Free projects pause after a week with no traffic. During a pilot, the worker's poll keeps the database awake. The web app is fine either way.

## 2. Cloudflare R2

1. R2 → Create bucket `glimpse` (location hint: APAC).
2. R2 → Manage API tokens → create an **Object Read & Write** token scoped to that bucket. Note the Access Key ID and Secret, plus the S3 endpoint `https://<account-id>.r2.cloudflarestorage.com`.
3. Bucket → Settings → CORS policy, so browsers can upload directly:
   ```json
   [{ "AllowedOrigins": ["https://<your-domain>"], "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
      "AllowedHeaders": ["*"], "ExposeHeaders": ["ETag"], "MaxAgeSeconds": 3600 }]
   ```
4. Keep the bucket **private**. Every image is served through short-lived presigned URLs.

## 3. Face worker on Oracle Always Free (Ampere, arm64)

1. Create a VM: Ampere A1 Flex, 4 OCPU / 24 GB RAM, Ubuntu 24.04. Allow **no** inbound ports except SSH (22).
2. Install Docker: `curl -fsSL https://get.docker.com | sh`.
3. Build and run the image. It is multi-arch, and the models are downloaded and checksum-verified during the build:
   ```bash
   git clone <repo> && cd <repo>/apps/worker
   docker build -t glimpse-worker .
   cat > worker.env <<'EOF'
   DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_BUCKET=glimpse
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   WORKER_TOKEN=<openssl rand -hex 32>
   CONCURRENCY=4
   EOF
   docker run -d --name glimpse-worker --restart unless-stopped --env-file worker.env -p 127.0.0.1:8787:8787 glimpse-worker
   ```
4. Expose the selfie API to the web app **without opening ports**, using Cloudflare Tunnel (free):
   ```bash
   # on the VM
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared
   cloudflared tunnel login && cloudflared tunnel create glimpse-worker
   cloudflared tunnel route dns glimpse-worker worker.<your-domain>
   cloudflared tunnel run --url http://127.0.0.1:8787 glimpse-worker     # then install as a service: cloudflared service install
   ```
   The worker authenticates every call with `WORKER_TOKEN`. The request body (the selfie) is never logged or stored.

Throughput measured on one x86 core: **1.24 photos/s** for 24 MP JPEGs with a few faces, and 0.96/s for dense group shots (~30 faces). With `CONCURRENCY=4`, expect roughly 4× that on the 4-core Ampere VM (ARM cores are a little slower per core). Measure yours with `uv run glimpse-face bench <folder>`.

## 4. Web app on Cloudflare Workers

```bash
cd apps/web
npx wrangler login
# secrets (never commit them)
for k in SUPABASE_SERVICE_ROLE_KEY S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY WORKER_TOKEN GUEST_SECRET; do npx wrangler secret put $k; done
# plain vars: set in wrangler.jsonc "vars" or the dashboard
#   APP_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, S3_ENDPOINT, S3_REGION=auto,
#   S3_BUCKET, WORKER_URL=https://worker.<your-domain>, MATCH_THRESHOLD, CLUSTER_MATCH_THRESHOLD
pnpm cf:deploy
```

`NEXT_PUBLIC_*` values are inlined at build time, so put them in `apps/web/.env.production` (not secret) before `cf:deploy`.
Then add a custom domain under Workers → Settings → Domains.

**Do not use Vercel Hobby.** Its terms forbid commercial use.

## 5. After deploying

- Visit `/design` to check fonts and tokens. Create an event and upload a few photos, then confirm the worker logs show `process_photo`.
- Expiry and hard deletion run inside the worker (maintenance loop, every 60 s). Nothing else needs scheduling.
- Backups: Supabase free has no point-in-time recovery. Run a nightly `pg_dump` from the VM (cron), keep 7 days, and store it in R2 under `backups/` with a lifecycle rule that deletes after 7 days:
  ```bash
  0 3 * * * pg_dump "$DATABASE_URL" --no-owner -Fc > /var/backups/glimpse-$(date +\%a).dump
  ```
  Photos in R2 are not backed up. Photographers keep their own originals, which is standard practice.
- Error monitoring (optional): Sentry's free Developer plan. If you add it, scrub request bodies on `/api/e/*/search` so a selfie can never be captured.
