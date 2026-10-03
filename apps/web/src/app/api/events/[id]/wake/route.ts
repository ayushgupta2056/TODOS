import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { wakeWorker } from "@/lib/worker";

/** POST /api/events/:id/wake — the dashboard calls this while photos are still processing. */
export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const sb = await supabaseServer();
  const { data } = await sb.from("events").select("id").eq("id", id).maybeSingle(); // RLS: owner only
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  await wakeWorker();
  return NextResponse.json({ ok: true });
}
