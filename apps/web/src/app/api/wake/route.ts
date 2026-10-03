import { NextResponse } from "next/server";
import { clientIpHash } from "@/lib/guest";
import { allow } from "@/lib/ratelimit";
import { wakeWorker } from "@/lib/worker";

/**
 * POST /api/wake — called by every page on load and on the first click, so the free-tier face
 * worker is already warm by the time someone uploads or takes a selfie. Rate-limited.
 */
export async function POST() {
  const ip = await clientIpHash();
  const [perIp, global] = await Promise.all([allow(`wake:${ip}`, 6, 600), allow("wake:global", 60, 60)]);
  if (perIp && global) await wakeWorker();
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
