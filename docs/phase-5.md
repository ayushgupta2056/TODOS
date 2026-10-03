# Phase 5 — Guest experience

**Built:** `/e/[slug]` (branded, full-bleed cover, PIN gate) → `/consent` (explicit, separate, un-ticked, logs
consent version + hashed IP) → `/find` (camera with oval mask, on-device MediaPipe BlazeFace hints: move closer,
more light, hold still, center, just you; upload fallback) → matching (camera turned off, amber scan) → "You're in
**N** photos" → `/me` (justified gallery, lightbox with swipe/keys, per-photo download, streamed ZIP, share, clear
my results) and optional `/all`.

**Privacy mechanics:** the selfie goes browser → `/api/e/[slug]/search` → worker `/v1/selfie/embed` in memory, and
is never written to storage, the DB or logs. Only the matched photo ids are kept, for 24h, so downloads work. Search is rate-limited
per IP+event and per event. Watermarked events never expose clean files.

**Verified:** Playwright run at 390px and 1440px in both themes. A selfie found 12/12 photos of that person in about 100ms of
search time. Lighthouse (mobile, production build): performance 92–95, accessibility 100, best practices 100. SEO
is intentionally noindex on private event pages.

**Tests:** `selfie-quality` unit tests. The full flow is covered by the e2e test (Phase 8).

**Costs:** none. MediaPipe WASM and the model are self-hosted, with no third-party CDN on the selfie page.
