# Phase 4 — Upload pipeline

**Built:**
- Event CRUD (create with slug + PIN + expiry; settings; delete). Delete drops embeddings immediately, then a worker job purges files and rows.
- Uploads: the browser hashes each file (SHA-256) → `POST /api/uploads/check` (skip duplicates, enforce plan) → Uppy 6
  `@uppy/aws-s3` straight to R2/S3 (multipart above 20 MB, 6 in parallel, resumable within the session) with each
  request presigned by `POST /api/uploads/sign` (a short-lived upload capability token, so there is no DB hit per part) →
  batched `POST /api/uploads/complete` (HEAD-verifies the object, `register_photo`, enqueue). Folder drag-and-drop included.
- Worker queue: `FOR UPDATE SKIP LOCKED`, one consumer thread per core, exponential backoff, permanent failure for
  unreadable files, stale-lock recovery, debounced `cluster_event` (at most 2 minutes behind).
- Dashboard: live processing panel (Supabase Realtime + a 10s poll fallback), photo grid with status badges,
  delete photo (files hard-deleted too), share tab with link + QR + downloadable print card.

**Verified:** browser upload of 8 files including a 26 MB multipart file and a duplicate → "7 added · 1 already
here", all processed.

**Costs:** R2 beyond 10 GB (see `docs/costs.md`).
