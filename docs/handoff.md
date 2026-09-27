# Design handoff

Source of truth: `packages/ui/src/styles/darkroom.css` (tokens) and `packages/ui/src/components/*`.
Live spec: `/design`. Rationale: `docs/design-decisions.md`.

## Breakpoints

| Name | Min width | Notes |
|---|---|---|
| base | 0 | guest screens designed at 390px |
| sm | 640px | two-column forms, guest content capped at 36rem |
| lg | 1024px | photographer left rail appears; bottom nav hides |
| xl | 1280px | event page shows the processing panel beside the grid |
| design width | 1440px | desktop screenshots |

## Spacing, radius, elevation

- Page gutters: 16px (mobile) / 24–32px (desktop). Section rhythm: 56px (`py-14`) to 128px on marketing.
- Radius: xs 4 · sm 6 · md 10 (inputs, buttons) · lg 14 (cards) · xl 20 (dialogs). Photos use 6px.
- Elevation is expressed with borders and surface steps (ink → surface → raised), not shadows. Shadows
  only on floating layers (dialog, sheet, toast, phone mock).

## Components and states

| Component | Variants / sizes | States |
|---|---|---|
| Button | primary, secondary, outline, ghost, danger, link · sm 36, md 44, lg 48, xl 56, icon 44 | hover, active (scale .98), focus ring 2px accent + 2px offset, disabled 45%, loading (spinner, `aria-busy`) |
| Input / Textarea | 44px high, `--control` border (≥3:1) | hover border, focus amber border + 25% ring, `aria-invalid` red border, disabled |
| Field | label + control + hint or error | error replaces hint, `role=alert` |
| Switch | 28×48 visual, 44px hit area, `--control` border | checked amber, focus ring |
| Badge | neutral, amber, success, danger · optional dot | — |
| Progress / ProgressRing | bar 6px · ring 104–120px, stroke 6 | value clamped 0–100, `role=progressbar` with `aria-valuenow` |
| Dialog | centred, max 32rem | open 260ms, Esc closes, focus trapped, title required |
| Sheet | right (desktop) or bottom (phone, with grabber) | open 320–360ms |
| Toast | neutral, success, danger | max 3, 4.5s, swipe down to dismiss |
| PhotoGrid | justified; `onOpen`, `renderOverlay` | skeleton before measure, blurhash, develop-on-load, hover zoom |
| EmptyState | icon + title + description + action | — |

## Accessibility contract

- WCAG AA contrast in both themes (see token table). Focus is always visible (2px accent outline).
- Touch targets ≥ 44px, including the icon buttons and the Switch's invisible hit area.
- Every icon-only control has an `aria-label`. Photos have alt text ("Photo 3 of 47 from …").
- Live regions: selfie hints (`aria-live=polite`), upload progress, processing status.
- Keyboard: lightbox ← → Esc; dialogs trap focus; the consent checkbox is a real checkbox.
- No drag-only interactions: the lightbox has visible prev/next buttons at every width (swipe is optional).
- Tokens: `--dr-*` primitives → semantic tokens (`darkroom.css`); non-CSS contexts use `fixed.*` from `@glimpse/ui/tokens`.
- `prefers-reduced-motion` honoured globally.

## Guest flow (390px)

1. `/e/[slug]`: full-bleed cover (dark), event name in display type, one primary CTA.
2. `/e/[slug]/consent`: four plain-language points, an un-ticked checkbox, CTA disabled until ticked.
3. `/e/[slug]/find`: camera with oval mask. The hint line turns amber when ready, the shutter is 76px, upload fallback on the left.
4. Matching: frozen frame + amber scan line. The camera is already off.
5. Reveal: "You're in **N** photos", count-up, then a single CTA.
6. `/e/[slug]/me`: justified grid, "Download all" (ZIP), lightbox with per-photo download, "Clear my results".
