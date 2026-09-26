# Phase 1 — Design system

**Built:** Darkroom tokens (dark + light, CSS variables → Tailwind v4 `@theme`), fonts (Instrument Serif,
Geist Sans/Mono self-hosted, Barlow Condensed for comparison), `packages/ui` components (Button, Input/Textarea/
Field, Card, Badge, Progress + ProgressRing, Dialog, Sheet, Toast, Switch, PhotoGrid + DevelopImage, EmptyState,
Logo), film grain + vignette utilities, reduced-motion handling, and a `/design` showcase with both display faces
side by side.

**Decisions:** `docs/design-decisions.md` (Instrument Serif chosen; `--accent` token for AA in light theme;
photo surfaces always dark).

**Tests:** `pnpm --filter @glimpse/ui test` (10 component tests: a11y roles, loading, dialog Esc, toast,
justified layout maths).

**Skills note:** the §6b design skills weren't available in this environment; see design-decisions.md.

**Costs:** none.
