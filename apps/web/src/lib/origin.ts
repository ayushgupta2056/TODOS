// Public origin of the site. Behind a hosting proxy (Render, Cloudflare) the request URL can be the
// internal address (e.g. https://localhost:10000), so redirects must never be built from it.
export function publicOrigin(fallback: string): string {
  return (process.env.APP_URL ?? process.env.RENDER_EXTERNAL_URL ?? fallback).replace(/\/$/, "");
}
