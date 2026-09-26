import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getStudio } from "@/lib/auth";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

const Plan = z.enum(["starter", "pro", "studio"]);

/** POST /api/billing/checkout — start a Razorpay subscription (optional; needs keys). */
export async function POST(req: NextRequest) {
  const studio = await getStudio();
  if (!studio) return NextResponse.redirect(new URL("/login", req.nextUrl.origin), { status: 303 });
  const plan = Plan.safeParse((await req.formData()).get("plan"));
  const e = env();
  const planId = plan.success
    ? { starter: e.RAZORPAY_PLAN_STARTER, pro: e.RAZORPAY_PLAN_PRO, studio: e.RAZORPAY_PLAN_STUDIO }[plan.data]
    : undefined;
  if (!plan.success || !e.RAZORPAY_KEY_ID || !e.RAZORPAY_KEY_SECRET || !planId) {
    return NextResponse.redirect(new URL("/app/billing", req.nextUrl.origin), { status: 303 });
  }
  const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${e.RAZORPAY_KEY_ID}:${e.RAZORPAY_KEY_SECRET}`)}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      plan_id: planId,
      total_count: 120,
      customer_notify: 1,
      notes: { studio_id: studio.id, plan: plan.data },
    }),
  });
  if (!res.ok) return NextResponse.redirect(new URL("/app/billing?status=error", req.nextUrl.origin), { status: 303 });
  const sub = (await res.json()) as { id: string; short_url: string };
  await supabaseAdmin().from("studios").update({ razorpay_subscription_id: sub.id }).eq("id", studio.id);
  return NextResponse.redirect(sub.short_url, { status: 303 });
}
