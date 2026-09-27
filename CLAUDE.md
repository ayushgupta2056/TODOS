# Glimpse — project memory

> "Glimpse" is a working name. Full brief: `docs/PROMPT.md`. Phase checklist: `docs/PLAN.md`.
> Re-read both at the start of every phase. Work **one phase at a time**; finish, show results, then wait for the go-ahead.

## What we're building

A SaaS for event photographers. A photographer creates an **Event**, bulk-uploads thousands of photos, and each photo is processed once in the background: detect faces → embed → store in a vector index scoped to that event. **Guests** open the event by QR/link, give consent, take a live selfie, and see **only the photos they appear in**, with single-photo or ZIP download.

## Non-negotiables (check every change against these)

1. **Zero spend.** Free tiers and open source only. Anything that needs a card is optional, documented, and the code works without it. If a free-tier limit or licence blocks something, **stop and ask** with options. Don't quietly switch to a paid service.
2. **Commercial-use licences only.**
   - Detection: **OpenCV Zoo YuNet (MIT)**. Recognition: **OpenCV Zoo SFace (Apache-2.0)**. Run them via `opencv-python-headless` (or onnxruntime).
   - **Never download or use InsightFace pretrained packs** (buffalo_l, antelopev2, …). Their weights are non-commercial.
   - Model licence files go in `/licenses`, with attribution in `NOTICE`.
   - Ask before adding any GPL/AGPL/NC dependency.
3. **`FaceEngine` interface**: `detect(img)` and `embed(img, face)`. Nothing outside the engine module imports OpenCV face APIs directly. Every `faces` row stores `engine_version`.
4. **Privacy by design (DPDP Act 2023 + DPDP Rules 2025, GDPR-style):**
   - Explicit, separate consent before the selfie.
   - **The selfie image is never written to disk, storage, logs or error reports.** Only its embedding exists, in memory, for one search, and is then discarded.
   - Face embeddings are event-scoped and hard-deleted when the event is deleted or expires.
   - **No cross-event face search, ever.** Every vector query filters by `event_id`.
   - Public privacy page and a "delete my face data" flow.

## Repo layout (target)

```
apps/web        Next.js (App Router, TS, Server Actions): marketing + photographer dashboard + guest app
apps/worker     Python 3.12 FastAPI + queue consumer + face pipeline + eval/
packages/ui     Design system ("Darkroom" tokens + components). The app uses ONLY these components.
packages/db     SQL migrations (Supabase/Postgres + pgvector), generated types
docs/           PROMPT.md, PLAN.md, phase-N.md, design-decisions.md, handoff.md
licenses/       third-party model licences
```

> **Legacy code:** the repo root also contains an unrelated Django todo API (`manage.py`, `todolistapi/`, `todos/`, `authentication/`, `helpers/`, `db.sqlite3`). It isn't part of Glimpse. Don't modify or delete it unless the user says so (see open questions in `docs/PLAN.md`).

## Stack (all free)

pnpm workspaces + Turborepo · Next.js App Router · Tailwind v4 + shadcn/ui (Radix) + Framer Motion + lucide-react · Geist / Geist Mono / Instrument Serif · Supabase (Postgres + pgvector + Auth magic link/Google + RLS + Realtime) · Cloudflare R2 (presigned multipart; MinIO locally) · Cloudflare Pages/Workers via `@opennextjs/cloudflare` (**not Vercel Hobby**, which forbids commercial use) · Python worker on an Oracle Always Free Ampere VM (Docker) · queue = Postgres `jobs` table + `SELECT … FOR UPDATE SKIP LOCKED` (no Redis) · Uppy + AWS S3 multipart → R2 · Razorpay Subscriptions (later, optional) · Resend (email) · Docker Compose (MinIO as the local S3) for fully-offline local dev.

## Data model essentials

`studios`, `events`, `photos` (sha256 UNIQUE per event), `faces` (`embedding vector(128)`, `engine_version`, `cluster_id`), `clusters`, `jobs`, `guest_sessions` (no selfie), `usage`.
- `faces`: HNSW index `vector_cosine_ops` plus a btree on `event_id`. **Always filter by `event_id`.**
- RLS: a studio sees only its own rows. Guests never read tables directly, only through server routes.

## Face pipeline rules

- Jobs are **idempotent and resumable**. A re-run must never duplicate faces (delete-then-insert per photo in one transaction, or upsert on a deterministic key).
- EXIF orientation fix → `web` (2048px long edge, WebP q80) + `thumb` (480px WebP) → YuNet detect on a 1600–2400px copy (score ≥ 0.7) + 2×2 tiled pass merged with NMS → filter (inter-eye < 20px or blurry: store flagged, don't embed) → `alignCrop` → `feature` → L2-normalise → store.
- Debounced `cluster_event` job after batches.
- Guest search: exactly one dominant face → embed in memory → pgvector top-K within `event_id` → cosine ≥ threshold (default **0.363**, configurable) → cluster expansion only if the centroid passes a stricter threshold → rank by score, then time.
- Throughput target: ≥ 1 photo/s per core. Worker concurrency = cores. Batch DB writes.
- Tune thresholds with `apps/worker/eval/` on labelled data, not guesses.

## Design: "Darkroom"

Premium, cinematic, calm. Photos are the hero.
- Tokens: ink `#0E0C0A`, surface `#171411`, raised `#201C18`, line `#2E2823`, paper `#F3EDE4`, muted `#A89E92`, **amber `#FF8A3D` (primary)**, red `#E5484D` (destructive), green `#46A758` (success). Dark-first, light theme supported.
- Type: Instrument Serif (display) + Geist Sans (UI) + Geist Mono (numbers/filenames). Barlow Condensed is the alternative display face. Show both side by side in Phase 1 before choosing.
- Film grain, soft vignette, photos fade in blur→sharp (400ms), spring transitions, `prefers-reduced-motion` respected. Blurhash placeholders.
- **Anti-goals:** no vibrant/playful palettes, no blob illustrations, no emoji, no purple-gradient SaaS look, no bouncy cartoon motion.
- A11y: WCAG AA, visible focus rings, keyboard-operable, alt text, 44px touch targets. Mobile-first for guests, desktop-first for photographers.
- **Screenshot loop:** every UI screen at 390px and 1440px, in both themes, reviewed before calling it done.
- Design skills workflow is in `docs/PROMPT.md` §6b. Record the decisions in `docs/design-decisions.md`.
- The `ui-ux-pro-max` skill pack is enabled in `.claude/settings.json`. Its adopted system lives in `design-system/glimpse/MASTER.md` (read it before designing a page; never `--persist --force` over it). Run `validate-tokens.cjs` (design-system skill) before shipping UI.

## Code rules

- TypeScript `strict`, **Zod on every input** (server actions, route handlers, env), **no `any`**.
- Python: full type hints, `ruff` (lint + format), `pytest`, mypy/pyright-clean.
- Never commit secrets. Only `.env.example` is committed.
- Rate-limit `/api/e/[slug]/search` per IP and per event.
- No complete file rewrites with "rest unchanged" placeholders. Output full files.

## Definition of done for every phase

1. Tests pass (JS + Python) and lint/typecheck are clean.
2. `docs/phase-N.md`: what was built, how to run it, what's left, and **a list of anything that would cost money**.
3. Tick the phase's boxes in `docs/PLAN.md`.
4. Show the user the result, then **stop and wait**.

## Commands

```bash
pnpm install                                   # JS deps (pnpm 10, Node 22)
pnpm db:start / pnpm db:stop / pnpm db:reset   # local Supabase (packages/db), ports 54321-54324
pnpm stack:up / pnpm stack:down                # MinIO S3 on :9000, console :9001 (add --profile worker for the worker container)
pnpm --filter @glimpse/db gen:types            # regenerate DB types after a migration
pnpm --filter @glimpse/web dev                 # web on :3000 (needs apps/web/.env.local)
pnpm --filter @glimpse/web seed [photos-dir]   # demo studio/event + one-click sign-in link
cd apps/worker && uv run glimpse-face serve --consume   # worker API :8787 + queue consumer
cd apps/worker && uv run glimpse-face index|search|bench|models
pnpm turbo run lint typecheck test             # everything (web, ui, db RLS, worker)
cd apps/web && pnpm e2e                        # Playwright full flow (needs E2E_PHOTOS_DIR, E2E_SELFIE)
pnpm --filter @glimpse/web cf:build            # Cloudflare Worker bundle (uses `next build --webpack`)
```

Gotchas:
- Next 16: `proxy.ts` (not middleware), async `params`/`cookies()`. Read `apps/web/node_modules/next/dist/docs/` before using unfamiliar APIs.
- Keep the Worker bundle under 3 MiB gzipped (free plan). Turbopack builds are too big, so builds use webpack.
- Presigned uploads must not send `x-amz-meta-*` headers (Uppy `allowedMetaFields: false`).
- Local S3 is MinIO via the frozen `bitnamilegacy/minio` image (official MinIO images are no longer pullable). MinIO has no bucket-CORS API: CORS comes from `MINIO_API_CORS_ALLOW_ORIGIN`. Fallback: `--profile seaweedfs` (:8333).

## Current status

- [x] Phases 0–8 built and verified locally (2026-09-26). See `docs/phase-N.md` and `docs/PLAN.md` for remaining items.
- Default match threshold is **0.42** (tuned on LFW). Re-tune on real event photos before launch.
- Open: psycopg (LGPL-3.0) is used unmodified in the worker; confirm OK or switch to pg8000 (BSD).
