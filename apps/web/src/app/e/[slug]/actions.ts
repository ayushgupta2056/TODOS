"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyPin } from "@/lib/crypto";
import { CONSENT_VERSION, clientIpHash, getPublicEvent, hasEventAccess, writeGuest } from "@/lib/guest";
import { allow } from "@/lib/ratelimit";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function unlockEvent(_: { error?: string } | null, form: FormData): Promise<{ error?: string } | null> {
  const slug = z.string().max(80).parse(form.get("slug"));
  const pin = String(form.get("pin") ?? "").trim();
  const ev = await getPublicEvent(slug);
  if (!ev) redirect("/");
  const ip = await clientIpHash();
  if (!(await allow(`pin:${ev.id}:${ip}`, 8, 600))) return { error: "Too many tries. Wait 10 minutes and try again." };
  const { data } = await supabaseAdmin().from("events").select("pin_hash").eq("id", ev.id).single();
  if (!(await verifyPin(pin, data?.pin_hash ?? null))) return { error: "That PIN didn't match. Check the card at the venue." };
  await writeGuest(ev.id, { p: 1 });
  redirect(`/e/${slug}`);
}

export async function giveConsent(form: FormData): Promise<void> {
  const slug = z.string().max(80).parse(form.get("slug"));
  const agreed = form.get("agree") === "yes";
  const ev = await getPublicEvent(slug);
  if (!ev) redirect("/");
  if (!(await hasEventAccess(ev))) redirect(`/e/${slug}`);
  if (!agreed) redirect(`/e/${slug}/consent?required=1`);
  const { data, error } = await supabaseAdmin()
    .from("guest_sessions")
    .insert({ event_id: ev.id, consent_at: new Date().toISOString(), consent_version: CONSENT_VERSION, ip_hash: await clientIpHash() })
    .select("id")
    .single();
  if (error || !data) redirect(`/e/${slug}/consent?error=1`);
  await writeGuest(ev.id, { s: data.id });
  redirect(`/e/${slug}/find`);
}

/** "Forget me": wipe this guest's matched list and consent cookie. */
export async function forgetMe(form: FormData): Promise<void> {
  const slug = z.string().max(80).parse(form.get("slug"));
  const ev = await getPublicEvent(slug);
  if (!ev) redirect("/");
  const { readGuest, clearGuest } = await import("@/lib/guest");
  const g = await readGuest(ev.id);
  if (g?.s) {
    await supabaseAdmin().from("guest_sessions").update({ matched_photo_ids: null, matches_expire_at: null }).eq("id", g.s).eq("event_id", ev.id);
  }
  await clearGuest(ev.id);
  redirect(`/e/${slug}?forgotten=1`);
}
