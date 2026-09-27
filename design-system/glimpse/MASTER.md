# Glimpse — Design System MASTER (ui-ux-pro-max convention)

> Global source of truth for the `ui-ux-pro-max` skill's retrieval flow: read this before designing
> any page, then check `pages/<page>.md` for overrides. Written by hand from the adopted "Darkroom"
> system. The skill's generated `--design-system` suggestion (Swiss minimal, pure black + white, Inter,
> `back.out` stagger) was reviewed and **rejected** on 2026-09-27 as off-brand. Do not regenerate with
> `--force` without the owner's approval.
> Code: `packages/ui/src/styles/darkroom.css`, `packages/ui/src/tokens.ts`. Brand: `docs/brand-guidelines.md`.
> Rationale: `docs/design-decisions.md`. Live: `/design`.

## Product
Event-photo SaaS. Photographers (desktop-first dashboard) + guests (mobile-first: QR → consent → selfie → "my photos").

## Pattern
- Marketing: hero with live demo → 3 steps → privacy → CTA. Photos are the hero.
- Guest: one primary action per screen, full-bleed dark photo and camera surfaces.
- Dashboard: left rail (≥1024px) / bottom nav (<1024px), cards with cover photo, live processing panel.

## Style
"Darkroom": premium, cinematic, calm. Warm near-black, one safelight-amber accent, film grain + vignette on hero imagery only.
Anti-patterns: vibrant/playful palettes, purple gradients, blobs, emoji, bouncy or overshoot motion, pure #000/#FFF UI.

## Colors (semantic → dark / light)
| Token | Dark | Light |
|---|---|---|
| --ink (bg) | #0E0C0A | #F5EFE6 |
| --surface | #171411 | #FBF8F3 |
| --raised | #201C18 | #FFFFFF |
| --line (decorative) | #2E2823 | #E4DACD |
| --control (form borders, ≥3:1) | #726860 | #8F8377 |
| --paper (text) | #F3EDE4 | #1A1613 |
| --muted | #A89E92 | #62584E |
| --amber (primary fill) | #FF8A3D | #FF8A3D |
| --accent (amber as text/focus) | #FF8A3D | #A84A0C |
| --red / --green | #E5484D / #46A758 | #C9363B / #2F7D3F |

## Typography
Instrument Serif (display, italic accents) · Geist Sans (UI) · Geist Mono (counts, filenames; tabular).
Shortlisted alternatives: Barlow Condensed (shown on /design), Playfair Display, Cormorant (skill suggestions). Not adopted.

## Effects & motion
Print-developing reveal (blur 12px→0, 400ms, ease-out-quint). Amber scan line while matching. Springs without overshoot
(stiffness ~420, damping ~38). Hover 150–300ms. Everything collapses under prefers-reduced-motion.

## Pre-delivery checklist (skill + project)
- [ ] 390px + 1440px, both themes, screenshots reviewed
- [ ] Contrast: text ≥4.5:1, control boundaries ≥3:1, focus ring visible
- [ ] Touch targets ≥44px, and no drag-only interactions (lightbox has buttons)
- [ ] Buttons show a pointer cursor; disabled states are non-interactive
- [ ] No hardcoded colours: `node <design-system skill>/scripts/validate-tokens.cjs --dir apps/web/src`
- [ ] Route `loading.tsx` for server-fetched pages
- [ ] No emoji icons (Lucide only)
