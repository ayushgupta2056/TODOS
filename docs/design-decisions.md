# Design decisions — "Darkroom"

Live reference: `/design` (every token and component, both themes). Code: `packages/ui`.

## Process note (skills)

**Pass 1 (2026-09-26):** the §6b skills weren't installed in the cloud session, so their principles were applied by hand.

**Pass 2 (2026-09-27): the `ui-ux-pro-max` skill pack was installed and used.** It came from
`nextlevelbuilder/ui-ux-pro-max-skill` (MIT, commit 823b0a1), and is enabled for this repo in `.claude/settings.json`,
the same way as branch `claude/install-ui-ux-skill-2omnxf` in `oibsip_task2`. Skills used: `ui-ux-pro-max`, `design-system`,
`brand`, `design` (logo brief), plus a `ui-styling` reference check. Results, following the brief's rule that
"taste and Darkroom override the lookup database":

| Skill step | Suggested | Decision |
|---|---|---|
| `search.py "premium photography gallery dark cinematic" --design-system` | Swiss minimal, pure black + white, zinc greys, white accent, Inter | **Rejected**: cold and generic, and it loses the warmth. Kept Darkroom. Adopted its "avoid heavy text / poor image showcase" and its pre-delivery checklist |
| same, motion | Stagger with `back.out(1.4)` | **Rejected**: overshoot is on the anti-goal list |
| `--domain typography` | Playfair Display + Inter, Cormorant + Montserrat | Shortlisted and recorded. Instrument Serif stays (more contemporary, better italic) |
| `--domain color` (wedding) | Pink #DB2777 wedding palette | **Rejected**: vibrant |
| `--domain color` (podcast) | Dark + orange accent | Confirms dark + warm-orange direction |
| `--domain ux` "dragging movements" (WCAG 2.2) | Non-drag alternative required | **Fixed**: lightbox ← → buttons now also show on phones (swipe was the only way) |
| pro-rules pre-delivery: control contrast | Boundaries ≥ 3:1 | **Fixed**: new `--control` token (#726860 dark 3.4:1, #8F8377 light 3.2:1) for inputs, switch, checkbox, selects. The old border was 1.7:1 |
| pre-delivery: pointer cursor | cursor-pointer on clickables | **Fixed**: base rule for buttons, radios, switches, labels, selects |
| `--stack nextjs` "loading states" | `loading.tsx` per route | **Fixed**: skeletons for /app, event page, guest /me |
| `--stack nextjs` "next/image" | Use `<Image>` | **Deliberate exception**: the worker pre-renders sized WebP (thumb 480 / web 2048) with blurhash. Next image optimisation on Cloudflare would need paid Cloudflare Images |
| `design-system` token architecture | Primitive → semantic → component | **Adopted**: `--dr-*` primitives + per-theme semantic tokens. Mirrored in `tokens.ts` for canvas/QR/meta, with a test that keeps them identical |
| `design-system/validate-tokens.cjs` | 15 hardcoded hex values in apps/web | **Fixed**: now 0 (QR, print card, theme-color, brand logic all use `fixed.*`) |
| `brand` template + `inject-brand-context.cjs` | Brand guideline doc | **Written**: `docs/brand-guidelines.md` (voice, prohibited terms, logo rules). Parses cleanly |
| `brand` colour check on marketing frames | On-palette? | Dominant colours sit close to ink/line tones (ΔRGB 2–33): on brand |
| `design` logo brief (photography) | Minimal line-art wordmark, aperture symbol, elegant serif | The current mark already matches (aperture ring + amber dot + serif italic). Kept |

The adopted system is also persisted in the skill's own convention at `design-system/glimpse/MASTER.md`, so future
skill runs read Darkroom instead of regenerating the rejected suggestion.

Not run: AI logo, banner and photo generation in the `design` skill. It needs paid Gemini/MuAPI keys, which conflicts with zero spend.

## Direction

A photographer's darkroom: near-black warm ink, paper-white type, a single **safelight amber** accent.
The interface recedes; photos glow. It is cinematic and calm, not playful.

Rejected on purpose (anti-goals from the brief): vibrant palettes, gradient-purple SaaS, blob
illustrations, emoji, bouncy cartoon motion. Stock photos of people were also rejected for marketing:
real faces raise model-release questions. The marketing frames are generated **bokeh** images of warm
venue lights (`apps/web/public/marketing`), which carry no licence risk. Replace them with the studio's
own work when available.

## Tokens

| Token | Dark | Light | Use |
|---|---|---|---|
| `--ink` | #0E0C0A | #F5EFE6 | page background |
| `--surface` | #171411 | #FBF8F3 | cards, inputs |
| `--raised` | #201C18 | #FFFFFF | hover, popovers |
| `--line` / `--line-strong` | #2E2823 / #463D35 | #E4DACD / #CDBFAE | decorative borders, dividers |
| `--control` | #726860 | #8F8377 | form-control boundaries (≥3:1, WCAG 1.4.11) |
| `--paper` | #F3EDE4 | #1A1613 | text |
| `--muted` | #A89E92 | #62584E | secondary text |
| `--amber` | #FF8A3D | #FF8A3D | primary fills (buttons, rings, focus on dark) |
| `--accent` | #FF8A3D | **#A84A0C** | amber used **as text or outline**; AA on each background |
| `--red` / `--green` | #E5484D / #46A758 | #C9363B / #2F7D3F | destructive / success |

Contrast (WCAG AA): paper on ink 17:1, muted on ink 7.3:1, ink on amber 8.9:1, accent on light ink 5.0:1.
The first light-theme pass used amber for text (2.1:1, a fail). That is why `--accent` exists.

**Photo and camera surfaces are always dark** (`data-theme="dark"` on the guest landing hero, selfie camera,
lightbox, marketing image cards). A photo on a cream page loses its drama, and the camera needs a dark
surround so skin tones read correctly.

Studios on Pro/Studio can override the accent (`brand_color`); readable text on it is chosen by luminance.

## Type

- **Display: Instrument Serif** (regular + italic). The italic carries the accent moments
  ("finds *themselves*", "You're in *47* photos"). It feels editorial, like a photo book.
- **Alternative: Barlow Condensed** (uppercase, tight). It is shown side by side on `/design`. It reads
  sporty and poster-like, closer to a fest than a wedding. **Instrument Serif was chosen**, and Barlow is
  loaded only on `/design`.
- **UI: Geist Sans**. **Numbers / filenames: Geist Mono** (tabular), not preloaded (it only sets small labels).
- Scale: display XL `clamp(3.25rem, 8vw, 7.5rem)`, line-height 0.92, tracking −0.03em. Big and confident.

## Motion (the craft layer)

| Moment | Spec |
|---|---|
| Photo reveal ("print developing") | `develop` 400ms `cubic-bezier(.22,1,.36,1)`: blur 12px → 0, saturation 0.4 → 1, slight brightness fall-off |
| Matching | amber scan line inside the oval, 1.8s ease-in-out-quart loop |
| Result count | number counts up with an expo-out ease (0.6–1.6s depending on the count) |
| Dialog / sheet | 260–360ms ease-out-quint; scale 0.97 → 1 for dialogs, slide for sheets |
| Lightbox | spring (stiffness 420, damping 38), horizontal drag to page |
| Buttons | 150ms colour; press = scale 0.98 (no bounce) |
| Hover on photos | scale 1.015 over 500ms |

Everything respects `prefers-reduced-motion`: animations collapse to 1ms, the hero demo freezes on its
final "found" state, and the counter shows the number directly.

## Texture

A static SVG fractal-noise **grain** (`.grain`, 7% overlay on dark, 4.5% on light) and a radial **vignette**
(`.vignette`) on hero photos only. Grids and dashboards stay clean.

## Layout

- Guests: mobile-first, full-bleed, one primary action per screen, 56px primary buttons, safe-area insets.
- Photographers: desktop-first, left rail (248px) collapsing to a top bar + bottom nav below 1024px.
- Photos: justified rows (target 280px guest, 180px studio), 6–8px gutters, blurhash placeholders.

## Copy voice

Plain, warm, specific. Say what happens ("Your selfie is never stored") instead of reassuring in the
abstract. Hints are imperative and short: "Move closer", "More light, please", "Hold still". Errors say
what to do next.

## Critique log (screenshot loop)

1. Hero demo: the phone covered a quarter of the contact sheet → phone moved beside a 3-column sheet.
2. Light theme: amber text failed AA → `--accent` token. Photo cards washed out → forced dark.
3. Barlow headline: `tailwind-merge` dropped the custom leading → line-height set inline.
4. Lighthouse guest landing: LCP 3.4s was caused by 5 preloaded fonts → Barlow scoped to `/design`, Geist Mono not preloaded,
   cover image `fetchpriority=low`. Now performance 92–95, accessibility 100, best practices 100.
