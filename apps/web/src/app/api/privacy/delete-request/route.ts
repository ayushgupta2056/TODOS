import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { clientIpHash } from "@/lib/guest";
import { allow } from "@/lib/ratelimit";
import { supabaseAdmin } from "@/lib/supabase/server";

const Body = z.object({
  event: z.string().trim().min(2).max(300),
  email: z.email().max(254),
  message: z.string().max(1000).optional(),
});

/** POST /api/privacy/delete-request — "delete my face data". Logged, forwarded to the studio. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the event link and your email." }, { status: 400 });
  if (!(await allow(`privacy:${await clientIpHash()}`, 5, 3600))) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }
  const slug = parsed.data.event.replace(/^.*\/e\//, "").replace(/[/?#].*$/, "").toLowerCase();
  const admin = supabaseAdmin();
  const { data: ev } = await admin.from("events").select("id, studio_id, name, studios!inner(owner_id)").eq("slug", slug).maybeSingle();
  await admin.from("privacy_requests").insert({
    event_id: ev?.id ?? null,
    event_slug: slug,
    email: parsed.data.email,
    message: parsed.data.message ?? null,
  });
  if (ev) {
    await admin.from("audit_log").insert({ studio_id: ev.studio_id, event_id: ev.id, actor: "guest", action: "privacy.delete_requested" });
    // Notify the studio (optional: Resend free tier). Works without keys; the request is stored either way.
    const e = env();
    if (e.RESEND_API_KEY && e.EMAIL_FROM) {
      const { data: owner } = await admin.auth.admin.getUserById(ev.studios.owner_id);
      if (owner.user?.email) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { authorization: `Bearer ${e.RESEND_API_KEY}`, "content-type": "application/json" },
          body: JSON.stringify({
            from: e.EMAIL_FROM,
            to: owner.user.email,
            reply_to: parsed.data.email,
            subject: `Face data deletion request — ${ev.name}`,
            text: `A guest asked for their photos and face data to be removed from "${ev.name}".\n\nContact: ${parsed.data.email}\nDetails: ${parsed.data.message ?? "(none)"}\n\nPlease remove the photos they appear in from the event (Events → ${ev.name} → Photos) and reply to confirm within 30 days.`,
          }),
        }).catch(() => undefined);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
