# Put Glimpse online with Render + Supabase (free, no card)

You get a real link like `https://glimpse-web.onrender.com` that works on any phone or laptop.

| Piece | Where | Free plan |
|---|---|---|
| Website | Render web service | Sleeps after 15 min idle; the first visit after that takes ~1 min |
| Face worker | Render web service (Docker) | Same sleeping. The site wakes it automatically |
| Database + login + photo storage | Supabase | 500 MB database, 1 GB storage, 50 MB per photo |

Takes about 20 minutes, all in the browser.

---

## 1. Supabase (database, login, storage)

1. Go to **supabase.com** → Sign in with GitHub → **New project**.
   Name `glimpse`, choose a database password (save it), region **Mumbai (ap-south-1)**. Create.
2. **SQL Editor** → **New query**. Open
   [`packages/db/hosted-setup.sql`](../packages/db/hosted-setup.sql) from this repo, copy everything, paste, and click **Run**.
   You should see "Success". This creates all the tables, the security rules and a private `glimpse` storage bucket.
3. **Storage** → **S3 Connection** (in the left list under Configuration) → make sure S3 is enabled → **New access key**.
   Copy these four values:
   - **Endpoint**, e.g. `https://abcd1234.storage.supabase.co/storage/v1/s3` → `S3_ENDPOINT`
   - **Region**, e.g. `ap-south-1` → `S3_REGION`
   - **Access key ID** → `S3_ACCESS_KEY_ID`
   - **Secret access key** → `S3_SECRET_ACCESS_KEY` (shown once)
4. **Project Settings → API** (or the **Connect** button). Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (secret; never share it)
5. **Connect** (top bar) → **Session pooler** → copy the URI and put your database password in place of `[YOUR-PASSWORD]`
   → `DATABASE_URL`

## 2. Render (website + worker)

1. Go to **render.com** → Sign up with GitHub → allow access to the `TODOS` repository.
2. **New +** → **Blueprint** → choose the `TODOS` repo → branch **`claude/new-session-vb6ovi`** → it finds `render.yaml`.
3. Fill in the values it asks for (from step 1). Leave `WORKER_URL` as `https://glimpse-worker.onrender.com` for now.
   Click **Apply**. Render builds both services (first build ~10 min).
4. When **glimpse-worker** is live, copy the URL shown at the top of its page. If it isn't exactly
   `https://glimpse-worker.onrender.com`, open **glimpse-web → Environment**, set `WORKER_URL` to it and save.

## 3. Tell Supabase your website address (for login emails)

Supabase → **Authentication → URL Configuration**:
- **Site URL**: your website URL, e.g. `https://glimpse-web.onrender.com`
- **Redirect URLs** → add `https://glimpse-web.onrender.com/**`

## 4. Test it

1. Open your website URL → **Start free** → enter your email → open the sign-in link from the email.
   (Supabase's built-in email only sends a few emails per hour. That's fine for testing.)
2. Name your studio → create an event → drop in photos (JPEG/PNG/WebP up to 50 MB each).
   The right-hand panel shows faces being found. On the free plan expect a few seconds per photo.
3. **Share** tab → open the guest link on your phone (or scan the QR) → **Find my photos** → tick consent →
   take a selfie (the live camera works because the site is HTTPS) → see your photos.

## Good to know

- **First load after idle is slow** (~1 minute) because free services sleep. Opening the consent page or
  uploading photos wakes the worker in the background.
- **Photos processing slowly?** The free worker has a small CPU share. It still finishes; it just takes longer.
- **Updating:** push to the branch and Render redeploys automatically.
- **Database changes later:** new migrations in `packages/db/supabase/migrations` must also be run in the SQL
  editor (or with `npx supabase db push` after `npx supabase link`).

---

## Current live deployment (2026-10-02)

| What | Where |
|---|---|
| Website | https://glimpse-web-8vwy.onrender.com (Render workspace **Glimpse**, service `glimpse-web`) |
| Face worker | https://glimpse-worker.onrender.com (service `glimpse-worker`) |
| Supabase | org **Glimpse**, project `glimpse` (ref `rmkbenhudfbxzqyywham`, Mumbai) |

Both Render services auto-deploy from branch `claude/new-session-vb6ovi`. Storage uses Supabase's
"session token" S3 auth (`S3_ACCESS_KEY_ID` = project ref, `S3_SECRET_ACCESS_KEY` = anon key,
`S3_SESSION_TOKEN` = service_role key), so no separate storage key is needed.
Verified live: sign-in, onboarding, upload → worker → 10/10 photos processed, selfie search (4/4 correct
matches, 0 wrong), gallery, ZIP, event hard-delete (DB rows and stored files).
