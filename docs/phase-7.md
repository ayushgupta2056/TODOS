# Phase 7 — Privacy & ops

**Built:**
- Expiry: the worker's maintenance loop (every 60s) marks expired events `deleting`, drops their face data
  immediately, and enqueues `delete_event` (hard-deletes every object under `events/<id>/` and cascades all rows).
- Studio delete uses the same path (`request_event_deletion`) and requires typing the event name.
- Guest "clear my results" + 24h automatic wipe of matched lists. Stale job locks are requeued, and old jobs are pruned.
- `/privacy` (DPDP Act 2023 / DPDP Rules 2025 + GDPR-style notice) with a **delete my face data** form →
  `privacy_requests` + audit log + optional email to the studio (Resend).
- `audit_log` for event create/delete, deletion requests and billing events (no biometric data).
- Backups and optional Sentry: documented in `docs/deploy.md`.

**Tests:** worker integration test proves that after expiry, zero faces, photos, clusters and objects remain. The e2e test proves
deleting an event removes its embeddings immediately.

**Costs:** none. Sentry is optional.
