import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { clientIpHash, getPublicEvent, hasEventAccess, readGuest } from "@/lib/guest";
import { allow } from "@/lib/ratelimit";
import { supabaseAdmin } from "@/lib/supabase/server";

const MAX_BYTES = 8 * 1024 * 1024;
const MATCH_TTL_H = 24;

const WorkerOk = z.object({ ok: z.literal(true), engine_version: z.string(), embedding: z.array(z.number()).length(128) });
const WorkerErr = z.object({ ok: z.literal(false), code: z.string() });

// A free-tier worker may be asleep or restarting: retry transient failures inside this budget.
const WORKER_BUDGET_MS = 90_000;
const ATTEMPT_TIMEOUT_MS = 35_000;
const RETRY_DELAY_MS = 3_000;

type Embedded = { ok: true; data: z.infer<typeof WorkerOk> } | { ok: false; code: string };

async function embedSelfie(workerUrl: string, token: string, bytes: ArrayBuffer): Promise<Embedded> {
  const deadline = Date.now() + WORKER_BUDGET_MS;
  for (;;) {
    const left = deadline - Date.now();
    try {
      const res = await fetch(`${workerUrl}/v1/selfie/embed`, {
        method: "POST",
        headers: { "x-worker-token": token, "content-type": "application/octet-stream" },
        body: bytes,
        signal: AbortSignal.timeout(Math.min(ATTEMPT_TIMEOUT_MS, left)),
      });
      const payload: unknown = await res.json().catch(() => null);
      const err = WorkerErr.safeParse(payload);
      if (err.success) return { ok: false, code: err.data.code };
      const ok = WorkerOk.safeParse(payload);
      if (ok.success) return { ok: true, data: ok.data };
      // 502/503 from the host while the worker boots: transient. Anything else is not.
      if (res.status < 500) return { ok: false, code: "unavailable" };
    } catch {
      // network error or timeout: the worker is waking up or restarting
    }
    if (deadline - Date.now() < RETRY_DELAY_MS + 5_000) return { ok: false, code: "unavailable" };
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
}

function fail(code: string, status: number) {
  return NextResponse.json({ code }, { status, headers: { "cache-control": "no-store" } });
}

/**
 * POST /api/e/:slug/search — body: the selfie image bytes.
 *
 * Privacy: the bytes are streamed to the face worker and dropped when this request ends. They
 * are never written to storage, the database or logs. Only the list of matched photo ids is
 * kept (24 h) so the guest can view and download them.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const ev = await getPublicEvent(slug);
  if (!ev) return fail("not_found", 404);
  if (!(await hasEventAccess(ev))) return fail("locked", 403);
  const guest = await readGuest(ev.id);
  if (!guest?.s) return fail("consent", 403);

  const ip = await clientIpHash();
  const [perIp, perEvent] = await Promise.all([
    allow(`search:ip:${ev.id}:${ip}`, 12, 600),
    allow(`search:event:${ev.id}`, 300, 60),
  ]);
  if (!perIp || !perEvent) return fail("rate_limited", 429);

  const type = req.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return fail("bad_image", 415);
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) return fail("bad_image", 413);
  const bytes = await req.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) return fail("bad_image", 413);

  const e = env();
  const embedded = await embedSelfie(e.WORKER_URL, e.WORKER_TOKEN, bytes);
  if (!embedded.ok) return embedded.code === "unavailable" ? fail("unavailable", 503) : fail(embedded.code, 422);

  const admin = supabaseAdmin();
  const { data: rows, error } = await admin.rpc("search_event_faces", {
    p_event_id: ev.id,
    p_embedding: `[${embedded.data.embedding.join(",")}]`,
    p_engine_version: embedded.data.engine_version,
    p_threshold: e.MATCH_THRESHOLD,
    p_cluster_threshold: e.CLUSTER_MATCH_THRESHOLD,
  });
  if (error) return fail("unavailable", 503);
  const ids = (rows ?? []).map((r) => r.photo_id);
  await admin
    .from("guest_sessions")
    .update({
      matched_photo_ids: ids,
      matched_count: ids.length,
      searched_at: new Date().toISOString(),
      matches_expire_at: new Date(Date.now() + MATCH_TTL_H * 3600_000).toISOString(),
    })
    .eq("id", guest.s)
    .eq("event_id", ev.id);
  return NextResponse.json({ count: ids.length }, { headers: { "cache-control": "no-store" } });
}
