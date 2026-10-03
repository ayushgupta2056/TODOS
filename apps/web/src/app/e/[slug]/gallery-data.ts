import "server-only";
import type { PublicEvent } from "@/lib/guest";
import { presignGet } from "@/lib/s3";
import { supabaseAdmin } from "@/lib/supabase/server";

export interface GuestPhoto {
  id: string;
  thumb: string;
  web: string;
  width: number;
  height: number;
  blurhash: string | null;
  takenAt: string | null;
}

/** Presigned URLs for photos a guest may see. Watermarked events never expose the clean web copy. */
export async function loadGuestPhotos(ev: PublicEvent, ids: string[] | "all", limit = 600): Promise<GuestPhoto[]> {
  let q = supabaseAdmin()
    .from("photos")
    .select("id, r2_key_thumb, r2_key_web, r2_key_web_wm, width, height, blurhash, taken_at")
    .eq("event_id", ev.id)
    .eq("status", "done");
  if (ids !== "all") {
    if (!ids.length) return [];
    q = q.in("id", ids.slice(0, limit));
  }
  const { data } = await q.order("taken_at", { ascending: true, nullsFirst: false }).limit(limit);
  const order = ids === "all" ? null : new Map(ids.map((id, i) => [id, i]));
  const rows = (data ?? []).filter((p) => p.r2_key_thumb && (ev.watermark ? p.r2_key_web_wm : p.r2_key_web));
  if (order) rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return Promise.all(
    rows.map(async (p) => ({
      id: p.id,
      thumb: await presignGet(ev.watermark ? (p.r2_key_web_wm ?? p.r2_key_thumb!) : p.r2_key_thumb!),
      web: await presignGet((ev.watermark ? p.r2_key_web_wm : p.r2_key_web)!),
      width: p.width ?? 3,
      height: p.height ?? 2,
      blurhash: p.blurhash,
      takenAt: p.taken_at,
    })),
  );
}
