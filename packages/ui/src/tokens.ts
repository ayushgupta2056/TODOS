/**
 * Darkroom primitives for places CSS variables can't reach: <canvas> drawing, QR codes,
 * <meta name="theme-color">, server-side brand logic. Must match the `--dr-*` primitives in
 * styles/darkroom.css (enforced by tokens.test.ts).
 */
export const primitives = {
  "ink-950": "#0e0c0a",
  "ink-900": "#171411",
  "ink-850": "#201c18",
  "ink-800": "#2e2823",
  "ink-700": "#463d35",
  "ink-600": "#1a1613",
  "stone-600": "#62584e",
  "stone-500": "#726860",
  "stone-450": "#6f665d",
  "stone-400": "#8f8377",
  "stone-300": "#a89e92",
  "paper-50": "#ffffff",
  "paper-100": "#fbf8f3",
  "paper-150": "#f5efe6",
  "paper-200": "#f3ede4",
  "paper-300": "#e4dacd",
  "paper-400": "#cdbfae",
  "amber-400": "#ff9d5c",
  "amber-500": "#ff8a3d",
  "amber-600": "#e97a30",
  "amber-800": "#a84a0c",
  "red-500": "#e5484d",
  "red-600": "#c9363b",
  "green-500": "#46a758",
  "green-700": "#2f7d3f",
} as const;

export type Primitive = keyof typeof primitives;

/** Fixed (theme-independent) roles used outside CSS. Print and QR are always dark-on-paper. */
export const fixed = {
  brandAccent: primitives["amber-500"],
  themeColor: primitives["ink-950"],
  printInk: primitives["ink-950"],
  printPaper: primitives["paper-200"],
  printMuted: primitives["stone-300"],
  onLightAccent: primitives["ink-950"],
  onDarkAccent: primitives["paper-50"],
} as const;
