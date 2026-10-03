# Phase 3 — Data + auth

**Built (`packages/db/supabase/migrations`):** `plans`, `studios`, `events`, `photos` (unique `(event_id, sha256)`),
`faces` (`vector(128)`, `engine_version`, HNSW cosine index + `event_id` btree), `clusters` (with centroid),
`jobs` (queue), `guest_sessions` (no selfie, no embedding), `usage`, `privacy_requests`, `audit_log`, `rate_limits`.

- **RLS:** a studio sees only its own rows. Plan/billing columns and event counters are not writable by users (column grants).
  Guests have no table access at all.
- **Service-role-only functions:** `register_photo` (idempotent + enqueue), `search_event_faces` (requires
  an event id, exact cosine within that event, then cluster expansion), `refresh_event_stats`, `hit_rate_limit`,
  `request_event_deletion`, `studio_storage_bytes`.
- Realtime publication on `events` for live dashboard counters.
- **Auth:** Supabase email magic link (PKCE, or `token_hash` for cross-device) + Google (toggle with
  `NEXT_PUBLIC_GOOGLE_AUTH`). Onboarding creates the studio (trial plan).

**Tests:** `pnpm --filter @glimpse/db test` — 5 RLS tests (isolation, no plan escalation, anon lockout,
functions denied to anon/authenticated).

**Costs:** none (Supabase free).
