# Phase 0 — Scaffold

**Built:** pnpm workspaces + Turborepo (`apps/web`, `apps/worker`, `packages/ui`, `packages/db`), strict TS base
config (`noUncheckedIndexedAccess`), ESLint (no `any`) + Prettier, Python project with ruff/mypy/pytest (uv),
Supabase CLI project in `packages/db`, Docker Compose (`infra/`) with SeaweedFS as the S3 stand-in plus the worker,
`.env.example` files, GitHub Actions CI (`.github/workflows/ci.yml`: web, worker, integration).

**Deviation:** MinIO images are no longer published on Docker Hub (they couldn't be pulled here), so local S3 is
**SeaweedFS** (Apache-2.0). It has the same S3 API, including presigned multipart and CORS.

**Run:** see the README quick start. `pnpm turbo run lint typecheck test` runs every check.

**Costs:** none.
