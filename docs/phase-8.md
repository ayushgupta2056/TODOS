# Phase 8 — Polish & launch

**Built:** Playwright e2e (`apps/web/e2e/flow.spec.ts`): magic-link sign-in → onboarding → create event →
upload (with a duplicate) → worker processes → guest consent → selfie → results → ZIP → privacy assertions →
delete event. It passes locally in about 22s.

```bash
cd apps/web
E2E_PHOTOS_DIR=/path/to/event-photos E2E_SELFIE=/path/to/selfie.jpg \
SUPABASE_SERVICE_ROLE_KEY=... pnpm e2e
```

Deploy guides: `docs/deploy.md` (Cloudflare Workers + R2 + Supabase + Oracle Ampere + Cloudflare Tunnel).
The Cloudflare build (`pnpm --filter @glimpse/web cf:build`) produces a **2.4 MiB gzipped** Worker (free limit 3 MiB). It
uses `next build --webpack`, because the Turbopack build duplicated chunks and came out at 4.2 MiB.

Lighthouse (mobile, simulated 4G): guest landing 92–95 performance / 100 accessibility / 100 best practices; consent 95/100/100.
To reach a stable ≥ 95, the next step is serving the cover image as the 480px thumb on phones.

Handoff spec: `docs/handoff.md`. Costs: `docs/costs.md`.

**Not done here:** `banner-design` / `slides` marketing assets, and user research (5 photographer interviews + 5
guest tests). Those need people and the design skills.
