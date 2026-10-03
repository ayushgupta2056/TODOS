# Glimpse — Master Build Prompt for Claude Code

> How to use: create an empty folder, open Claude Code in it, and paste everything below the line as your first message. Then run the phases one at a time ("Start Phase 1", "Start Phase 2" …). Save this file in the repo as `docs/PROMPT.md` so Claude can re-read it.
> "Glimpse" is a working name — find/replace it with your brand.

---

You are the lead engineer building **Glimpse**, a SaaS for event photographers. Read this whole brief, then write `CLAUDE.md` (project memory) and `docs/PLAN.md` (checklist of every phase), then STOP and wait for me to say "Start Phase 1".

## 1. Product

- **Photographers** (paying subscribers) create an *Event* (wedding, college fest, corporate), and bulk-upload ("dump") thousands of photos.
- **Every uploaded photo is processed once** in the background: detect all faces → create a face embedding for each → store embeddings in a vector index scoped to that event. Processing must be resumable and idempotent (re-running never duplicates faces).
- **Guests** open the event via QR code / link, give consent, take a live selfie, and see **only the photos they appear in**. They can download individual photos or a ZIP.
- Photographer controls: event cover & branding (logo, colours), public/PIN-protected event, guest downloads on/off, watermark on/off, expiry date, delete event (hard-deletes photos + embeddings).
- Subscription tiers (limits enforced server-side): Free trial (1 event, 500 photos), Starter, Pro, Studio — photos/month, storage GB, active events, custom branding.

## 2. Hard constraints

1. **Zero spend to build and pilot.** Only free tiers / open source. Anything that needs a card must be optional and documented.
2. **Every model must be licensed for commercial use.** Use **OpenCV Zoo YuNet (MIT) for detection and SFace (Apache-2.0) for recognition**, run via `opencv-python-headless` (or onnxruntime). **Do NOT download or use InsightFace pretrained packs (buffalo_l, antelopev2, etc.) — their weights are non-commercial research only.** Put the model license files in `/licenses` and a `NOTICE` file.
3. Keep the recognizer behind an interface (`FaceEngine` with `detect(img)` and `embed(img, face)`) so a stronger licensed model can be swapped in later without touching the rest of the code. Store `engine_version` on every face row.
4. **Privacy by design (India DPDP Act 2023 + DPDP Rules 2025, and GDPR-style):** explicit, separate consent before the selfie; the selfie image is never written to disk or storage — only its embedding is used in memory for the search and then discarded; face embeddings are event-scoped, deleted when the event is deleted/expires; a public privacy page; a "delete my face data" request flow; no cross-event face search ever.

## 3. Stack (all free)

| Layer | Choice | Why |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | `apps/web`, `apps/worker`, `packages/ui`, `packages/db` |
| Web app | Next.js (App Router, TypeScript, Server Actions) | one codebase for marketing, photographer dashboard and guest app |
| UI | Tailwind CSS v4, shadcn/ui (Radix), Framer Motion, lucide-react, Geist + Instrument Serif fonts | see §6 |
| Auth + DB | Supabase free tier: Postgres + **pgvector** + Auth (email magic link + Google) + Row Level Security | vectors live next to relational data |
| Photo storage | **Cloudflare R2** (S3 API, 10 GB free, zero egress) | browser uploads straight to R2 with presigned multipart URLs |
| Web hosting | Cloudflare Pages / Workers (free, commercial use allowed) via `@opennextjs/cloudflare` | Vercel Hobby forbids commercial use — don't use it |
| Face worker | Python 3.12, FastAPI, OpenCV DNN (YuNet + SFace), Pillow/pyvips, numpy | CPU-only, no GPU needed |
| Worker host | Oracle Cloud Always Free Ampere VM (Docker) — or my laptop during dev | runs the queue consumer 24/7 |
| Queue | Postgres table + `SELECT … FOR UPDATE SKIP LOCKED` (no Redis needed) | fewer moving parts |
| Uploads UI | Uppy with AWS S3 multipart plugin → R2 | resumable, 1000s of files, folders |
| Payments (later) | Razorpay Subscriptions (no monthly fee, per-transaction only) | India-first |
| Email | Resend free tier | "Your photos are ready" |
| Local dev | Docker Compose: Supabase CLI local stack + MinIO (as R2 stand-in) + worker | runs fully offline |

## 4. Data model (Postgres, via SQL migrations in `packages/db`)

- `studios` (photographer account, plan, limits, branding)
- `events` (studio_id, slug, name, date, cover_key, visibility: public|pin, pin_hash, allow_download, watermark, expires_at, status)
- `photos` (event_id, r2_key_original, r2_key_web, r2_key_thumb, width, height, bytes, sha256 UNIQUE per event, taken_at from EXIF, status: uploaded|processing|done|failed|no_faces, error)
- `faces` (photo_id, event_id, bbox, landmarks, det_score, blur_score, embedding `vector(128)`, cluster_id, engine_version)
- `clusters` (event_id, representative_face_id, size) — people groups per event
- `jobs` (type, payload jsonb, status, attempts, run_after, locked_at) — the queue
- `guest_sessions` (event_id, consent_at, ip_hash, matched_count) — no selfie stored
- `usage` (studio_id, month, photos_processed, storage_bytes)
- Index: `CREATE INDEX ON faces USING hnsw (embedding vector_cosine_ops);` plus `(event_id)` btree. Always filter by `event_id`.
- RLS: studios see only their own rows; guests never read tables directly — only through server routes.

## 5. Face pipeline (apps/worker)

1. **Ingest**: after an R2 upload completes, web app inserts `photos` row + a `process_photo` job.
2. **Worker** claims job → downloads original from R2 → fixes EXIF orientation → writes `web` (2048px long edge, WebP q80) and `thumb` (480px, WebP) back to R2.
3. **Detect** on a 1600–2400px copy with YuNet (score ≥ 0.7). For big group photos, also run a 2×2 tiled pass so small faces (YuNet's range is ~10–300px) aren't missed; merge with NMS.
4. **Filter**: drop faces with inter-eye distance < 20px or Laplacian blur below threshold (store them flagged, don't embed).
5. **Align + embed** with `FaceRecognizerSF.alignCrop` → `feature` → L2-normalise → store 128-d vector.
6. **Cluster** (debounced `cluster_event` job after each batch): agglomerative / DBSCAN on cosine distance within the event → `cluster_id`. Clusters improve recall: a selfie that matches one strong face in a cluster pulls in that person's harder shots (side profile, partial occlusion).
7. **Guest search**: selfie → exactly one dominant face required (else friendly error) → embed in memory → pgvector top-K within `event_id` → accept matches with cosine similarity ≥ threshold (start at SFace's reference 0.363, make it configurable, tune on a labelled test set) → expand by cluster (only clusters whose centroid also passes a stricter threshold) → return photo ids ranked by score, then time.
8. **Throughput target**: ≥ 1 photo/sec per CPU core; worker concurrency = number of cores; batch DB writes.
9. **Evaluation**: `apps/worker/eval/` script that takes a folder of labelled photos (`person_x/…`) and reports precision/recall per threshold. We tune thresholds with data, not guesses.

## 6. Design direction — "Darkroom"

The UI must look premium, cinematic and calm — like a photographer's darkroom, not a generic SaaS template.

- **Palette** (CSS variables, dark-first, light theme also supported): ink `#0E0C0A`, surface `#171411`, raised `#201C18`, line `#2E2823`, paper `#F3EDE4`, muted `#A89E92`, **safelight amber `#FF8A3D`** (primary), developer-red `#E5484D` (destructive), fixer-green `#46A758` (success).
- **Type** (default; finalised in Phase 1 with `ui-ux-pro-max`): Instrument Serif (display, large headlines, italic accents) + Geist Sans (UI) + Geist Mono (counts, filenames). Candidate alternative display face: Barlow Condensed, which `ui-ux-pro-max` suggested earlier. Build the landing hero in both and show me side by side before choosing. Big confident headlines, tight tracking.
- **Texture & motion**: subtle film-grain overlay, soft vignette on hero photos, photos fade in like a print developing (blur→sharp, 400ms), spring-based transitions, `prefers-reduced-motion` respected.
- **Photos are the hero**: masonry/justified grid, generous gutters, no heavy chrome. Blurhash placeholders while loading.
- **Guest selfie screen**: full-bleed camera with an oval face guide; live feedback ("Move closer", "More light", "Hold still") from on-device detection (MediaPipe Face Detector or face-api tiny model in the browser — Apache/MIT only), an amber scan-line sweep while matching, then a reveal: "You're in **47** photos".
- **Photographer dashboard**: left rail nav, event cards with cover photo, a live processing panel (photos uploaded / faces found / people detected, progress ring), drag-and-drop dump zone that accepts folders.
- Mobile-first for guests (most guests are on phones via QR), desktop-first for photographers.
- Accessibility: WCAG AA contrast, visible focus rings, keyboard-operable, alt text, 44px touch targets.
- Build a small design system in `packages/ui` first (tokens, Button, Input, Card, Badge, Progress, Dialog, Sheet, Toast, PhotoGrid, EmptyState) and use only these in the app.
- **Anti-goals** (earlier feedback was "looks childish"): no vibrant/playful palettes, no rounded-blob illustrations, no emoji, no gradient-purple SaaS look, no bouncy cartoon motion. Restraint over decoration.

## 6b. Design skills — use them, in this order

I have these skills installed. Invoke them by name at the steps below. Don't skip them, and don't paste their whole output into the chat. Apply it to the code and summarise the decisions in `docs/design-decisions.md`.

**How they fit together:** `ui-ux-pro-max` is a lookup database. Use it for options (fonts, palettes, UX rules). The taste skills and `emil-design-eng` are the judges. When they disagree, taste wins, and §6 "Darkroom" plus the anti-goals above override both.

| When | Skill | Use it for |
|---|---|---|
| Phase 1 start | `brand` / `brandkit` | Name, logo mark, voice, tokens for Glimpse, within the Darkroom direction |
| Phase 1 | `ui-ux-pro-max` | Run `search.py "premium photography gallery dark cinematic" --design-system`, plus `--domain typography` and `--domain ux`. Shortlist 2–3 font pairings and check the palette against it. **Only adopt a suggestion if it fits Darkroom.** Reject vibrant/playful results. |
| Phase 1 | `design-system` / `ui-styling` | Turn the chosen tokens into Tailwind v4 theme + `packages/ui` components |
| Phase 1 | `high-end-visual-design`, `design-taste-frontend` | Taste pass on the `/design` showcase page before any product screen is built |
| Before coding each key screen (landing, selfie, results reveal, dashboard, upload) | `imagegen-frontend-mobile` (guest screens) / `imagegen-frontend-web` (dashboard, marketing) → then `image-to-code` | Generate a visual concept first, pick the best, then implement it faithfully |
| Every screen | `emil-design-eng` | Interaction and motion craft: easing, springs, the print-developing photo reveal, the scan-line, toast/sheet behaviour, hover/press states, `prefers-reduced-motion` |
| Every screen | `minimalist-ui` | Strip anything that doesn't earn its place; photos stay the hero |
| All copy | `design:ux-copy` | Consent screen, selfie hints ("Move closer", "More light"), empty states, errors, pricing |
| End of each UI phase | `design:design-critique` then `redesign-existing-projects` | Critique screenshots honestly, then fix the top issues. Repeat until no major issue is left. |
| End of each UI phase | `design:accessibility-review` | WCAG AA audit; fix everything flagged before moving on |
| Phase 8 | `design:design-handoff` | Final spec of tokens, states, breakpoints in `docs/handoff.md` |
| Marketing launch | `banner-design`, `slides` | Social banners and a pitch deck for photographers |
| Long code outputs | `full-output-enforcement` | No truncated files or "rest stays the same" placeholders |
| Before any real users | `design:user-research` → `design:research-synthesis` | 5 photographer interviews + 5 guest usability tests; synthesise, then adjust |

Don't use `industrial-brutalist-ui`, since it clashes with the premium photography brand. Only use `gpt-taste` / `stitch-design-taste` / `design-taste-frontend-v1` as a second opinion if two candidate designs are tied.

**Screenshot loop:** for every UI screen, run the dev server and take screenshots at 390px (phone) and 1440px (desktop) in both themes. Look at them yourself before telling me it's done.

## 7. Routes

- Marketing: `/` (hero with live demo), `/pricing`, `/privacy`, `/terms`
- Photographer: `/app` (events), `/app/events/new`, `/app/events/[id]` (photos, upload, processing, share/QR, settings), `/app/billing`, `/app/brand`
- Guest: `/e/[slug]` (event landing) → `/e/[slug]/consent` → `/e/[slug]/find` (selfie) → `/e/[slug]/me` (my photos) and `/e/[slug]/all` (optional full gallery)
- API: `POST /api/uploads/sign`, `POST /api/uploads/complete`, `POST /api/e/[slug]/search`, `GET /api/e/[slug]/zip`, `POST /api/privacy/delete-request`
- Rate-limit `/search` per IP + per event.

## 8. Phases (do one at a time, run tests, show me the result, then wait)

- **Phase 0 — Scaffold**: monorepo, lint/format, Docker Compose (Supabase local, MinIO, worker), env example, CI (GitHub Actions free), `CLAUDE.md`.
- **Phase 1 — Design system**: follow §6b rows for Phase 1. Deliver tokens, fonts, components in `packages/ui`, a `/design` showcase page, and `docs/design-decisions.md`.
- **Phase 2 — Face engine proof**: worker script that takes a local folder, detects + embeds + clusters, and a CLI `search selfie.jpg` that prints matching files. Include the eval script. Download YuNet + SFace ONNX from the official opencv_zoo repo with checksum verification.
- **Phase 3 — Data + auth**: migrations, RLS, Supabase auth, studio onboarding.
- **Phase 4 — Upload pipeline**: event CRUD, Uppy → R2 multipart, `complete` endpoint, jobs table, worker consumes, live progress in the dashboard (Supabase Realtime).
- **Phase 5 — Guest experience**: event landing, consent, selfie capture with on-device quality checks, search, results reveal, download/ZIP, share. This is the screen that sells the product. Run the full §6b loop here (imagegen → image-to-code → emil-design-eng → critique → a11y).
- **Phase 6 — Plans & limits**: plan table, usage metering, limit enforcement, Razorpay test-mode subscription (optional; code works without keys).
- **Phase 7 — Privacy & ops**: expiry cron, hard-delete, delete-my-data flow, audit log, Sentry free tier (optional), backups.
- **Phase 8 — Polish & launch**: Lighthouse ≥ 95 on guest pages, e2e tests (Playwright) for upload → process → selfie → results, deploy guides for Cloudflare + Oracle VM.

## 9. Working rules

- TypeScript strict, Zod on every input, no `any`. Python: typed, ruff, pytest.
- Never commit secrets; `.env.example` only.
- Every phase ends with: tests passing, a short `docs/phase-N.md` of what was built and how to run it, and a list of anything that would cost money.
- If a free-tier limit or licence blocks something, stop and tell me with options instead of silently choosing a paid service.
- Ask me before adding any dependency with a non-permissive licence (GPL/AGPL/NC).
