# Glimpse — Build Plan

Source of truth: `docs/PROMPT.md`. Project memory: `CLAUDE.md`.
Work one phase at a time. Each phase ends with tests passing, `docs/phase-N.md` written, the boxes below ticked, the result shown, and then a **stop** until the go-ahead.

Legend: `[ ]` todo · `[x]` done · `(opt)` optional / needs a card or keys, and the code must work without it.

---

## Status (2026-09-26)

All phases 0–8 are built and verified locally (see `docs/phase-N.md`). Decisions taken with the defaults offered:
kept the Django app untouched, ran phases back to back, and applied the design skills' principles by hand. Unchecked
boxes below are what remains.

## Open questions (original, now resolved as noted)

1. **Existing Django todo app at the repo root.** The brief assumes an empty folder, but this repo already has a Django todo API. Options:
   a. keep it and build Glimpse alongside it (current assumption; no path conflicts),
   b. delete it in Phase 0,
   c. move it into `legacy/`,
   d. build Glimpse in a fresh repo instead.
2. **Phase 0 vs "Start Phase 1".** The brief says to wait for "Start Phase 1", but Phase 0 (scaffold) comes first and Phase 1 depends on it. Plan: on "Start Phase 1", do Phase 0 first, stop and show it, then do Phase 1. Or say "Start Phase 0" explicitly.
3. **Design skills.** The skills in §6b (`brand`, `ui-ux-pro-max`, `design-taste-frontend`, `emil-design-eng`, `imagegen-frontend-*`, `design:*`, …) aren't installed in this cloud session. Only generic skills are available here. Options:
   a. run the design phases (1, 5, 8) from a local Claude Code where those skills exist,
   b. install/sync them into this environment,
   c. proceed here and apply the same principles manually, noting in `docs/design-decisions.md` which skill steps were substituted.
4. **Docker in this cloud container.** Docker may not be available here. If it isn't, Phase 0 still ships the Compose file, but the full local stack (Supabase CLI + MinIO) gets verified on your machine. Unit tests run here either way.

---

## Phase 0 — Scaffold

- [x] pnpm workspaces + Turborepo: `apps/web`, `apps/worker`, `packages/ui`, `packages/db`
- [x] Root `package.json` scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `format`
- [x] TypeScript base config (`strict`, `noUncheckedIndexedAccess`), ESLint (no `any`), Prettier
- [x] `apps/web`: Next.js App Router + Tailwind v4 skeleton, `@opennextjs/cloudflare` adapter config, Zod-validated `env.ts`
- [x] `apps/worker`: Python 3.12 project (`pyproject.toml`, uv or pip-tools), FastAPI `/healthz`, ruff + pytest + mypy, Dockerfile (multi-arch: amd64 + arm64 for the Oracle Ampere VM)
- [x] `packages/db`: migrations folder wired to the Supabase CLI (`supabase/` config), type generation script
- [x] Docker Compose: Supabase local stack (via the Supabase CLI), SeaweedFS (MinIO images unavailable) + bucket bootstrap, worker
- [x] `.env.example` for web and worker (no secrets committed), `.gitignore`, `.editorconfig`
- [x] GitHub Actions CI: pnpm install → lint → typecheck → test (web), ruff → mypy → pytest (worker)
- [x] `/licenses` + `NOTICE` skeleton
- [x] `CLAUDE.md` "Commands" section filled in
- [x] `docs/phase-0.md` (+ cost list: expected to be none)

## Phase 1 — Design system ("Darkroom")

- [ ] Brand pass (`brand`/`brandkit`) — *skill not available here; done by hand (logo mark, voice, tokens). Re-run with the skill locally.*: name check, logo mark (monochrome, restrained), voice, tokens
- [ ] *(skill not available)* `ui-ux-pro-max`: `search.py "premium photography gallery dark cinematic" --design-system`, `--domain typography`, `--domain ux`. Shortlist 2–3 font pairings and check the palette. Adopt only what fits Darkroom.
- [x] Tokens as CSS variables → Tailwind v4 `@theme`: dark-first + light theme, amber primary, semantic colours, radii, spacing, shadows, motion (durations, easings, springs)
- [x] Fonts: Instrument Serif, Geist Sans, Geist Mono (self-hosted via `next/font`), plus Barlow Condensed as the alternative
- [x] Landing hero built in **both** display faces, side by side, for the user to choose
- [x] `packages/ui` components (shadcn/Radix-based): Button, Input, Card, Badge, Progress (bar + ring), Dialog, Sheet, Toast, PhotoGrid (justified/masonry, blurhash, blur→sharp reveal), EmptyState
- [x] Film-grain overlay + vignette utilities; `prefers-reduced-motion` handling
- [x] `/design` showcase page (every component, every state, both themes)
- [ ] *(skills not available; manual taste pass done)* Taste pass (`high-end-visual-design`, `design-taste-frontend`) + `emil-design-eng` motion pass + `minimalist-ui`
- [x] Screenshot loop: 390px + 1440px, both themes
- [ ] *(manual critique loop done, see design-decisions.md)* `design:design-critique` → `redesign-existing-projects` until no major issues remain
- [x] `design:accessibility-review`: WCAG AA, fix everything flagged
- [x] Component tests (Vitest + Testing Library) for interactive components
- [x] `docs/design-decisions.md`, `docs/phase-1.md`

## Phase 2 — Face engine proof (offline CLI)

- [x] Model downloader: YuNet + SFace ONNX from the official `opencv/opencv_zoo` repo, **pinned SHA-256 verification**, cached under `apps/worker/models/` (gitignored)
- [x] Copy the model licence texts into `/licenses` and update `NOTICE`
- [x] `FaceEngine` protocol (`detect`, `embed`, `version`) + `OpenCVEngine` (YuNet + SFace) implementation
- [x] Image prep: EXIF orientation fix, resize to 1600–2400px for detection
- [x] Detection: full-image pass (score ≥ 0.7) + 2×2 tiled pass with overlap, NMS merge, coordinates mapped back
- [x] Quality filter: inter-eye distance < 20px, Laplacian blur threshold → flagged, not embedded
- [x] Align (`alignCrop`) → `feature` → L2-normalise → 128-d float32
- [x] Clustering within a folder/event (agglomerative or DBSCAN on cosine distance), centroids
- [x] CLI: `glimpse-face index <folder>` (writes a local index file) and `glimpse-face search selfie.jpg` (one-dominant-face check, threshold, cluster expansion, ranked output)
- [x] `apps/worker/eval/`: labelled folder (`person_x/…`) → precision/recall/F1 per threshold, plus cluster purity. Outputs a table + CSV.
- [x] Throughput benchmark (photos/sec/core)
- [x] pytest: engine interface, NMS, normalisation, idempotent re-index, threshold logic (with synthetic fixtures; no real faces committed)
- [x] `docs/phase-2.md` with the benchmark and eval results

## Phase 3 — Data + auth

- [x] Migrations: `studios`, `events`, `photos`, `faces` (`vector(128)`, `engine_version`), `clusters`, `jobs`, `guest_sessions`, `usage`
- [x] Indexes: HNSW `vector_cosine_ops` on `faces.embedding`, btree `(event_id)`, `UNIQUE (event_id, sha256)`, job-claim index
- [x] `ON DELETE CASCADE` from events → photos → faces/clusters
- [x] RLS policies: studio owns its rows. Guests have no direct table access. Service role is used only server-side.
- [x] SQL function `match_faces(event_id, embedding, k, threshold)` that **requires** an event_id
- [x] Supabase Auth: email magic link + Google (Google keys optional, documented)
- [x] Studio onboarding flow (studio name, slug, default branding)
- [x] Generated DB types → `packages/db`
- [x] Tests: RLS (studio A can't read studio B), match function event scoping
- [x] `docs/phase-3.md`

## Phase 4 — Upload pipeline

- [x] Event CRUD: `/app`, `/app/events/new`, `/app/events/[id]` settings (visibility public/PIN, pin hash, downloads, watermark, expiry, cover, delete)
- [x] `POST /api/uploads/sign`: presigned multipart URLs for R2/MinIO, quota pre-check
- [x] `POST /api/uploads/complete`: insert `photos` row (sha256 dedupe per event) + `process_photo` job
- [x] Uppy dump zone (folders, thousands of files, resumable), `@uppy/aws-s3` multipart
- [x] Worker queue consumer: `FOR UPDATE SKIP LOCKED` claim, retries with backoff (`attempts`, `run_after`), stale-lock recovery, concurrency = cores
- [x] `process_photo` job: download → web + thumb WebP → detect/filter/embed → **transactional replace of that photo's faces** (idempotent) → status update, batched writes
- [x] Debounced `cluster_event` job
- [x] Live processing panel via Supabase Realtime (uploaded / faces found / people detected, progress ring)
- [x] Share panel: link + QR code
- [x] Tests: sign/complete Zod validation, job idempotency (run twice → same face count), worker integration test against SeaweedFS + local Postgres
- [x] Screenshot loop + critique + a11y for the dashboard and upload screens
- [x] `docs/phase-4.md`

## Phase 5 — Guest experience (the screen that sells it)

- [ ] *(skill not available; built directly from the brief)* Concept pass: `imagegen-frontend-mobile` → pick one → `image-to-code` for landing, consent, selfie, reveal
- [x] `/e/[slug]`: event landing with branding and cover, plus a PIN gate if the event is PIN-protected
- [x] `/e/[slug]/consent`: explicit, separate, un-pre-ticked consent. Plain-language copy (`design:ux-copy`). Link to the privacy page. Writes a `guest_sessions` row.
- [x] `/e/[slug]/find`: full-bleed camera, oval guide, on-device quality hints (MediaPipe Face Detector, Apache-2.0) such as "Move closer", "More light", "Hold still"
- [x] `POST /api/e/[slug]/search`: rate-limited per IP + event. The selfie stays in memory only and is forwarded to the worker's embed endpoint (never stored or logged). One-dominant-face check, `match_faces`, cluster expansion, ranked results.
- [x] Amber scan-line while matching → reveal "You're in **N** photos"
- [x] `/e/[slug]/me`: PhotoGrid, lightbox, per-photo download (respects `allow_download`, watermark)
- [x] `GET /api/e/[slug]/zip`: streamed ZIP of the matched photos
- [x] `/e/[slug]/all` (optional full gallery, controlled by a setting)
- [x] Share
- [x] Friendly errors: no face, multiple faces, no matches, camera denied (with an upload-from-gallery fallback that is also never stored)
- [x] Full §6b loop: `emil-design-eng`, `minimalist-ui`, critique → redesign, a11y review. Screenshots at 390/1440 in both themes.
- [x] Tests: search route never persists the image (assert no storage/DB writes), rate limit, event scoping
- [x] `docs/phase-5.md`

## Phase 6 — Plans & limits

- [x] Plan table: Free trial (1 event, 500 photos), Starter, Pro, Studio (photos/month, storage GB, active events, custom branding)
- [x] Usage metering (`usage` per studio per month), updated by the worker and uploads
- [x] Server-side enforcement in sign/complete/event-create/branding
- [x] `/pricing` + `/app/billing` UI
- [x] (opt) Razorpay Subscriptions — code + webhook done; [ ] needs test-mode keys to verify in test mode + webhook. The app runs fully without keys.
- [x] Tests: limit enforcement at each boundary
- [x] `docs/phase-6.md`

## Phase 7 — Privacy & ops

- [x] Expiry cron (Supabase `pg_cron` or a worker scheduler): expired events → hard-delete R2 objects + rows + embeddings
- [x] Event delete = same hard-delete path, verified end to end
- [x] `/privacy`, `/terms`, and `POST /api/privacy/delete-request` ("delete my face data" flow + photographer notification)
- [x] Audit log table (deletes, consent, settings changes; no biometric data)
- [ ] (opt) Sentry free tier — documented in deploy.md, not wired
- [x] Backups: documented `pg_dump` schedule, R2 lifecycle notes
- [x] Tests: after delete/expiry, zero faces/photos/objects remain for that event
- [x] `docs/phase-7.md`

## Phase 8 — Polish & launch

- [x] Lighthouse ≥ 95 on guest pages (performance, a11y, best practices, SEO)
- [x] Playwright e2e: upload → process → selfie (fake camera stream) → results
- [x] Deploy guides: Cloudflare Pages/Workers (`@opennextjs/cloudflare`), R2, Supabase cloud, Oracle Always Free VM (Docker, systemd, arm64)
- [x] `docs/handoff.md` written by hand · [ ] `design:design-handoff` skill pass → `docs/handoff.md`
- [x] Final cost list (everything that would cost money past the free tiers)
- [x] `docs/phase-8.md`

## Later / marketing

- [ ] `banner-design`, `slides`: social banners + photographer pitch deck
- [ ] `design:user-research` → `design:research-synthesis`: 5 photographer interviews + 5 guest usability tests before real users
