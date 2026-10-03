# Phase 0 — Scaffold

**Built:** pnpm workspaces + Turborepo (`apps/web`, `apps/worker`, `packages/ui`, `packages/db`), strict TS base
config (`noUncheckedIndexedAccess`), ESLint (no `any`) + Prettier, Python project with ruff/mypy/pytest (uv),
Supabase CLI project in `packages/db`, Docker Compose (`infra/`) with MinIO as the S3 stand-in plus the worker,
`.env.example` files, GitHub Actions CI (`.github/workflows/ci.yml`: web, worker, integration).

**Local S3 = MinIO**, as in the brief. The official `minio/minio` images are no longer publicly pullable, so
compose uses Bitnami's frozen build `bitnamilegacy/minio:2025.5.24`. It is dev-only and never shipped. MinIO is
AGPL-3.0, which is fine for unmodified local use. MinIO has no per-bucket CORS API, so browser-upload CORS is set with
`MINIO_API_CORS_ALLOW_ORIGIN`. If that image ever disappears, `--profile seaweedfs` starts SeaweedFS (Apache-2.0,
:8333) as a drop-in.

**Run:** see the README quick start. `pnpm turbo run lint typecheck test` runs every check.

**Costs:** none.
