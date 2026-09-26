import { NextResponse } from "next/server";
import { z } from "zod";
import { checkUpload, getUsage } from "@/lib/plans";
import { headObject } from "@/lib/s3";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ORIGINAL_KEY, readUploadToken } from "@/lib/upload-token";

const Body = z.object({
  token: z.string().min(10),
  files: z
    .array(
      z.object({
        key: z.string().max(200),
        name: z.string().max(255),
        type: z.string().max(100),
        size: z.number().int().min(1).max(200 * 1024 * 1024),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
      }),
    )
    .min(1)
    .max(50),
});

/** POST /api/uploads/complete — register uploaded originals and enqueue face processing. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const token = await readUploadToken(parsed.data.token);
  if (!token) return NextResponse.json({ error: "upload session expired, reload the page" }, { status: 401 });
  const admin = supabaseAdmin();
  const { data: studio } = await admin.from("studios").select("*").eq("id", token.studio).single();
  if (!studio) return NextResponse.json({ error: "studio not found" }, { status: 404 });
  const usage = await getUsage(studio);
  const verdict = checkUpload(usage, parsed.data.files.length, parsed.data.files.reduce((a, f) => a + f.size, 0));
  if (!verdict.ok) return NextResponse.json({ error: verdict.reason }, { status: 402 });

  const results: { key: string; photoId: string | null; created: boolean; error?: string }[] = [];
  for (const f of parsed.data.files) {
    const m = ORIGINAL_KEY.exec(f.key);
    if (!m || m[1] !== token.event) {
      results.push({ key: f.key, photoId: null, created: false, error: "key not allowed" });
      continue;
    }
    const head = await headObject(f.key);
    if (!head) {
      results.push({ key: f.key, photoId: null, created: false, error: "object missing" });
      continue;
    }
    const { data, error } = await admin.rpc("register_photo", {
      p_event_id: token.event,
      p_key: f.key,
      p_name: f.name,
      p_content_type: f.type,
      p_bytes: head.size,
      p_sha256: f.sha256,
    });
    const row = data?.[0];
    results.push({
      key: f.key,
      photoId: row?.photo_id ?? null,
      created: row?.created ?? false,
      ...(error ? { error: error.message } : {}),
    });
  }
  return NextResponse.json({ results });
}
