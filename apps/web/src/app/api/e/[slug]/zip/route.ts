import { downloadZip } from "client-zip";
import { NextResponse } from "next/server";
import { getGuestMatches, getPublicEvent, hasEventAccess } from "@/lib/guest";
import { slugify } from "@/lib/format";
import { allow } from "@/lib/ratelimit";
import { getObject } from "@/lib/s3";
import { supabaseAdmin } from "@/lib/supabase/server";

const MAX_FILES = 500;

/** GET /api/e/:slug/zip — stream a ZIP of this guest's matched photos (no temp files). */
export async function GET(_: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const ev = await getPublicEvent(slug);
  if (!ev || !ev.allow_download || !(await hasEventAccess(ev))) return new NextResponse("Not found", { status: 404 });
  const m = await getGuestMatches(ev.id);
  if (!m?.photoIds.length) return new NextResponse("No photos to download", { status: 404 });
  if (!(await allow(`zip:${m.sessionId}`, 5, 3600))) return new NextResponse("Too many downloads, try later", { status: 429 });
  const { data } = await supabaseAdmin()
    .from("photos")
    .select("id, r2_key_original, r2_key_web_wm, original_name, taken_at")
    .eq("event_id", ev.id)
    .eq("status", "done")
    .in("id", m.photoIds.slice(0, MAX_FILES));
  const photos = (data ?? []).sort((a, b) => (a.taken_at ?? "").localeCompare(b.taken_at ?? ""));
  const used = new Set<string>();
  async function* files() {
    for (const p of photos) {
      const key = ev!.watermark ? p.r2_key_web_wm : p.r2_key_original;
      if (!key) continue;
      const ext = key.split(".").pop() ?? "jpg";
      let name = `${(p.original_name ?? p.id).replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_")}.${ext}`;
      while (used.has(name)) name = `${p.id.slice(0, 6)}-${name}`;
      used.add(name);
      const res = await getObject(key);
      yield { name, input: res, lastModified: p.taken_at ? new Date(p.taken_at) : new Date() };
    }
  }
  const zip = downloadZip(files());
  return new NextResponse(zip.body, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${slugify(ev.name) || "photos"}-my-photos.zip"`,
      "cache-control": "no-store",
    },
  });
}
