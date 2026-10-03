# Brand Guidelines v1.0 — Glimpse

> Last updated: 2026-09-27
> Status: Draft (pilot). Structured with the `brand` skill template, so `inject-brand-context.cjs` can read it.
> Source of truth for values: `packages/ui/src/styles/darkroom.css` + `packages/ui/src/tokens.ts`.

## Quick Reference

| Element | Value |
|---------|-------|
| Primary Color | #FF8A3D (safelight amber) |
| Background | #0E0C0A (ink) |
| Display Font | Instrument Serif |
| UI Font | Geist Sans |
| Voice | Calm, Precise, Warm, Discreet |

---

## 1. Color Palette

### Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Safelight Amber | #FF8A3D | rgb(255,138,61) | Primary buttons, progress, the one accent per screen |
| Amber Deep | #A84A0C | rgb(168,74,12) | Amber as text or focus ring on light backgrounds (AA) |

### Secondary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Amber Hover | #FF9D5C | rgb(255,157,92) | Hover on primary |
| Amber Press | #E97A30 | rgb(233,122,48) | Pressed primary |

### Neutral Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Ink | #0E0C0A | rgb(14,12,10) | Page background (dark), text on amber |
| Surface | #171411 | rgb(23,20,17) | Cards, inputs (dark) |
| Raised | #201C18 | rgb(32,28,24) | Hover, popovers (dark) |
| Line | #2E2823 | rgb(46,40,35) | Decorative dividers (dark) |
| Control | #726860 | rgb(114,104,96) | Form-control borders, ≥3:1 (dark) |
| Paper | #F3EDE4 | rgb(243,237,228) | Text (dark); print and QR background |
| Muted | #A89E92 | rgb(168,158,146) | Secondary text (dark) |
| Light Ink | #F5EFE6 | rgb(245,239,230) | Page background (light) |
| Light Text | #1A1613 | rgb(26,22,19) | Text (light) |

### Semantic Colors

| State | Hex | Usage |
|-------|-----|-------|
| Success | #46A758 | Processed, live, saved (light theme: #2F7D3F) |
| Error | #E5484D | Destructive actions, errors (light theme: #C9363B) |
| Info | #FF8A3D | Neutral notices use the accent, never blue |

### Accessibility

- Paper on ink: 17:1 (AAA). Muted on ink: 7.3:1. Ink on amber: 8.9:1.
- Amber is never used as text on light backgrounds. Use Amber Deep (5.0:1).
- Control borders are ≥3:1 in both themes (WCAG 1.4.11). Focus ring: 2px accent, 2px offset.

---

## 2. Typography

### Font Stack

```css
--font-heading: 'Instrument Serif', ui-serif, Georgia, serif;
--font-body: 'Geist', ui-sans-serif, system-ui, sans-serif;
--font-mono: 'Geist Mono', ui-monospace, monospace;
```

### Type Scale

| Element | Size (Desktop) | Size (Mobile) | Weight | Line Height |
|---------|----------------|---------------|--------|-------------|
| Display XL | 120px | 52px | 400 | 0.92 |
| Display L | 76px | 40px | 400 | 0.98 |
| Display M | 48px | 32px | 400 | 1.02 |
| Body Large | 18px | 18px | 400 | 1.6 |
| Body | 15–16px | 16px | 400 | 1.5 |
| Small | 14px | 14px | 400 | 1.5 |
| Eyebrow (mono caps) | 11.5px | 11.5px | 400 | 1.4 |

Display type is always Instrument Serif. The *italic* carries accent moments ("You're in *47* photos").
Numbers, counts and file names use Geist Mono with tabular figures. Never set body copy in the serif.

---

## 3. Logo Usage

### Variants

| Variant | File | Use Case |
|---------|------|----------|
| Wordmark + mark | `Logo` component | Headers |
| Mark only | `LogoMark` component | App icon, loaders, guest header |
| Favicon | `apps/web/src/app/icon.svg` | Browser tab |

### Clear Space

Minimum clear space = the diameter of the amber dot × 2 around the ring.

### Minimum Size

| Context | Minimum Width |
|---------|---------------|
| Digital - Full Logo | 96px |
| Digital - Mark | 16px |

### Don'ts

- Don't recolour the ring. It is always paper (or ink on light). Only the dot is amber
- Don't add gradients, glows or shadows
- Don't place the mark on a busy photo without the dark scrim

---

## 4. Voice & Tone

### Brand Personality

| Trait | Description |
|-------|-------------|
| **Calm** | We sound like the steady photographer at a chaotic wedding |
| **Precise** | Say exactly what happens, with numbers when we have them |
| **Warm** | Human and a little celebratory, never cute |
| **Discreet** | Privacy is shown through specifics, not slogans |

### Voice Chart

| Trait | We Are | We Are Not |
|-------|--------|------------|
| Calm | Unhurried, reassuring | Hype-y, exclamation-heavy |
| Precise | "Your selfie is never stored" | "We take privacy seriously" |
| Warm | "Found you." | Emoji, "Yay!!" |
| Discreet | Quiet about the tech | Showing off "AI" |

### Tone by Context

| Context | Tone | Example |
|---------|------|---------|
| Marketing | Confident, editorial | "Every guest finds themselves." |
| Guest hints | Short imperative | "Move closer" · "More light, please" · "Hold still" |
| Error messages | Calm, next step first | "We couldn't see a face. Face the camera in good light and try again." |
| Success | Brief, one accent | "You're in 47 photos" |
| Consent | Plain, specific, un-ticked | "Here's exactly what happens to your face." |

### Prohibited Terms

| Avoid | Reason |
|-------|--------|
| AI-powered | Guests don't care. It also sounds like surveillance |
| Facial recognition (in guest copy) | Use "face matching", which is accurate and less alarming |
| Revolutionary / seamless | Overused |
| Magic | Implies we hide how it works |
| Emoji | Anti-goal: breaks the calm register |

---

## 5. Imagery Guidelines

### Photography Style

- The customer's photos are the hero. Chrome recedes: no frames, no heavy overlays
- Warm, low-key, cinematic. A soft vignette only on hero images
- Marketing placeholders are generated bokeh "venue lights" with no people. Replace them with licensed studio work

### Illustrations

None. No blobs, mascots or 3D shapes.

### Icons

Lucide, 1.5–2px stroke, 16–20px, never filled, never emoji.

### Style Keywords

| Keyword | Meaning |
|---------|---------|
| darkroom | near-black warm surfaces, one amber light |
| editorial | serif display, generous space, restraint |
| print developing | photos fade blur → sharp, 400ms |

### Visual Don'ts

| Don't | Why |
|-------|-----|
| Vibrant or playful palettes | Looks childish (earlier feedback) |
| Purple/blue gradient SaaS look | Generic |
| Bouncy / overshoot motion | Not calm |
| Pure black #000 or pure white UI | Loses the warmth of the darkroom |

---

## 6. Design Components

### Buttons

| Type | Background | Text | Border Radius |
|------|------------|------|---------------|
| Primary | #FF8A3D | #0E0C0A | 10px |
| Secondary | Raised + Line-strong border | Paper | 10px |
| Ghost | Transparent | Muted → Paper | 10px |
| Danger | #E5484D | #FFFFFF | 10px |

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps |
| sm | 8px | Photo grid gutters (6–8) |
| md | 16px | Mobile page gutter, field gaps |
| lg | 24px | Card padding, desktop gutter |
| xl | 56px | Section rhythm (app) |
| 2xl | 128px | Section rhythm (marketing) |

### Border Radius

| Element | Radius |
|---------|--------|
| Buttons / Inputs | 10px |
| Cards | 14px |
| Modals | 20px |
| Photos | 6px |
| Badges | 4px (not pills) |
