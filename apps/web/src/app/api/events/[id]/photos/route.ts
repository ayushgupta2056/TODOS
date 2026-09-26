import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { presignGet } from "@/lib/s3";
import { supabaseServer } from "@/lib/supabase/server";

const Query = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(120),
});

/** GET /api/events/:id/photos — the studio's own photos (RLS-scoped), newest first. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const q = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return NextResponse.json({ error: "bad query" }, { status: 400 });
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, count, error } = await sb
    .from("photos")
    .select("id, original_name, width, height, blurhash, status, face_count, r2_key_thumb, r2_key_web, error", { count: "exact" })
    .eq("event_id", id)
    .order("created_at", { ascending: false })
    .range(q.data.offset, q.data.offset + q.data.limit - 1);
  if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });
  const photos = await Promise.all(
    (data ?? []).map(async (p) => ({
      id: p.id,
      name: p.original_name ?? "photo",
      width: p.width ?? 3,
      height: p.height ?? 2,
      blurhash: p.blurhash,
      status: p.status,
      faces: p.face_count,
      error: p.error,
      thumb: p.r2_key_thumb ? await presignGet(p.r2_key_thumb) : null,
      web: p.r2_key_web ? await presignGet(p.r2_key_web) : null,
    })),
  );
  return NextResponse.json({ photos, total: count ?? 0 }, { headers: { "cache-control": "no-store" } });
}
