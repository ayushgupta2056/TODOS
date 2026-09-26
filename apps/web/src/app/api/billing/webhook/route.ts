import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

const Event = z.object({
  event: z.string(),
  payload: z.object({
    subscription: z.object({
      entity: z.object({
        id: z.string(),
        status: z.string(),
        current_end: z.number().nullable().optional(),
        notes: z.object({ studio_id: z.uuid(), plan: z.enum(["starter", "pro", "studio"]) }).partial().optional(),
      }),
    }),
  }),
});

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Razorpay subscription webhooks -> studio plan. Signature-verified. */
export async function POST(req: Request) {
  const secret = env().RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 404 });
  const body = await req.text();
  const expected = await hmacHex(secret, body);
  if (req.headers.get("x-razorpay-signature") !== expected) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  const parsed = Event.safeParse(JSON.parse(body));
  if (!parsed.success) return NextResponse.json({ ok: true });
  const sub = parsed.data.payload.subscription.entity;
  const studioId = sub.notes?.studio_id;
  const plan = sub.notes?.plan;
  if (!studioId || !plan) return NextResponse.json({ ok: true });
  const admin = supabaseAdmin();
  const active = ["subscription.activated", "subscription.charged", "subscription.resumed"].includes(parsed.data.event);
  const ended = ["subscription.cancelled", "subscription.completed", "subscription.halted"].includes(parsed.data.event);
  if (active) {
    await admin
      .from("studios")
      .update({
        plan,
        plan_status: "active",
        razorpay_subscription_id: sub.id,
        plan_renews_at: sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null,
      })
      .eq("id", studioId);
  } else if (ended) {
    await admin.from("studios").update({ plan: "trial", plan_status: "cancelled" }).eq("id", studioId).eq("razorpay_subscription_id", sub.id);
  } else if (parsed.data.event === "subscription.pending") {
    await admin.from("studios").update({ plan_status: "past_due" }).eq("id", studioId);
  }
  await admin.from("audit_log").insert({ studio_id: studioId, actor: "razorpay", action: parsed.data.event, detail: { subscription: sub.id, plan } });
  return NextResponse.json({ ok: true });
}
