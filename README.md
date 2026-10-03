# Glimpse

Event photographers upload a whole shoot once. Guests scan a QR code, give consent, take a selfie,
and see **only the photos they're in**. Private by design, and free to build and pilot.

> "Glimpse" is a working name. Brief: [`docs/PROMPT.md`](docs/PROMPT.md) · Plan: [`docs/PLAN.md`](docs/PLAN.md) · Project memory: [`CLAUDE.md`](CLAUDE.md)

```
apps/web        Next.js 16 (App Router): marketing, photographer dashboard, guest app, API routes
apps/worker     Python 3.12: YuNet + SFace face pipeline, Postgres job queue, selfie-embed API, CLI, eval
packages/ui     "Darkroom" design system (tokens + components); the app uses only these
packages/db     Supabase migrations (Postgres + pgvector + RLS), generated types, RLS tests
infra           Docker Compose: MinIO (R2 stand-in) + worker container
```

The repo root also still contains an older, unrelated Django todo API (`manage.py`, `todos/`, …). It isn't
part of Glimpse and is left untouched.

## Quick start (local, fully offline once images are pulled)

Prerequisites: Node 22 + pnpm 10, Python 3.12 + [uv](https://docs.astral.sh/uv/), Docker.

```bash
pnpm install
pnpm db:start                       # Supabase: Postgres+pgvector, Auth, Realtime, Mailpit (54321-54324)
pnpm stack:up                       # MinIO S3 on :9000 (console :9001, glimpse / glimpse-secret)
cp apps/web/.env.example apps/web/.env.local     # paste anon + service keys from `pnpm --filter @glimpse/db status`
cp apps/worker/.env.example apps/worker/.env

# terminal 1 — face worker (API on :8787 + queue consumer); downloads + verifies the models once
cd apps/worker && uv sync && uv run glimpse-face serve --consume

# terminal 2 — web app on :3000
pnpm --filter @glimpse/web dev

# optional: demo studio + event, filled from a folder of your own photos
pnpm --filter @glimpse/web seed ./path/to/photos     # prints a one-click sign-in link
```

Sign-in emails (magic links) land in Mailpit at http://127.0.0.1:54324.

## Checks

```bash
pnpm turbo run lint typecheck test        # web, ui, db (RLS), worker (ruff, mypy, pytest)
cd apps/web && E2E_PHOTOS_DIR=… E2E_SELFIE=… pnpm e2e    # full upload → process → selfie → results flow
cd apps/worker && uv run python eval/evaluate.py <labelled-folder>   # precision/recall per threshold
```

## Face CLI (no database needed)

```bash
cd apps/worker
uv run glimpse-face index ./photos           # detect, embed, cluster -> ./.index
uv run glimpse-face search selfie.jpg        # matching files, best first
uv run glimpse-face bench ./photos           # photos/sec on one core
```

## Deploy

**Quickest (free, no card): [Render + Supabase](docs/deploy-render.md)**: a real public link in about 20 minutes.


See [`docs/deploy.md`](docs/deploy.md): Cloudflare Workers (web), Supabase free (DB/Auth), Cloudflare R2 (photos),
Oracle Cloud Always Free Ampere VM (worker). What costs money and when: [`docs/costs.md`](docs/costs.md).
