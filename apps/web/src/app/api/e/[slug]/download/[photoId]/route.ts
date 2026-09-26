import { NextResponse } from "next/server";
import { z } from "zod";
import { getGuestMatches, getPublicEvent, hasEventAccess } from "@/lib/guest";
import { presignGet } from "@/lib/s3";
import { supabaseAdmin } from "@/lib/supabase/server";

/** GET /api/e/:slug/download/:photoId — one photo, if this guest may have it. */
export async function GET(_: Request, ctx: { params: Promise<{ slug: string; photoId: string }> }) {
  const { slug, photoId } = await ctx.params;
  if (!z.uuid().safeParse(photoId).success) return new NextResponse("Not found", { status: 404 });
  const ev = await getPublicEvent(slug);
  if (!ev || !ev.allow_download || !(await hasEventAccess(ev))) return new NextResponse("Not found", { status: 404 });
  if (!ev.show_all_gallery) {
    const m = await getGuestMatches(ev.id);
    if (!m?.photoIds.includes(photoId)) return new NextResponse("Not found", { status: 404 });
  }
  const { data: p } = await supabaseAdmin()
    .from("photos")
    .select("r2_key_original, r2_key_web_wm, original_name")
    .eq("id", photoId)
    .eq("event_id", ev.id)
    .eq("status", "done")
    .maybeSingle();
  if (!p) return new NextResponse("Not found", { status: 404 });
  const key = ev.watermark ? p.r2_key_web_wm : p.r2_key_original;
  if (!key) return new NextResponse("Not ready", { status: 409 });
  const base = (p.original_name ?? "photo").replace(/\.[^.]+$/, "");
  const ext = key.split(".").pop() ?? "jpg";
  const url = await presignGet(key, { expiresIn: 300, downloadName: `${base}.${ext}` });
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "no-store" } });
}
