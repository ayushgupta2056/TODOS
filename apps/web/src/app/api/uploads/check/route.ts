import { NextResponse } from "next/server";
import { z } from "zod";
import { checkUpload, getUsage } from "@/lib/plans";
import { supabaseAdmin } from "@/lib/supabase/server";
import { readUploadToken } from "@/lib/upload-token";

const Body = z.object({
  token: z.string().min(10),
  files: z.array(z.object({ sha256: z.string().regex(/^[0-9a-f]{64}$/), size: z.number().int().min(1) })).max(20000),
});

/** POST /api/uploads/check — which files are already in the event, and does the rest fit the plan? */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const token = await readUploadToken(parsed.data.token);
  if (!token) return NextResponse.json({ error: "upload session expired, reload the page" }, { status: 401 });
  const admin = supabaseAdmin();
  const hashes = [...new Set(parsed.data.files.map((f) => f.sha256))];
  const existing = new Set<string>();
  for (let i = 0; i < hashes.length; i += 500) {
    const { data } = await admin
      .from("photos")
      .select("sha256")
      .eq("event_id", token.event)
      .in("sha256", hashes.slice(i, i + 500));
    for (const r of data ?? []) existing.add(r.sha256);
  }
  const fresh = parsed.data.files.filter((f) => !existing.has(f.sha256));
  const { data: studio } = await admin.from("studios").select("*").eq("id", token.studio).single();
  if (!studio) return NextResponse.json({ error: "studio not found" }, { status: 404 });
  const verdict = checkUpload(await getUsage(studio), fresh.length, fresh.reduce((a, f) => a + f.size, 0));
  return NextResponse.json({
    existing: [...existing],
    allowed: verdict.ok,
    reason: verdict.ok ? null : verdict.reason,
  });
}
