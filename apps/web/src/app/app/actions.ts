"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getStudio, getUser, requireOwnedEvent, requireStudio } from "@/lib/auth";
import { hashPin } from "@/lib/crypto";
import { randomSuffix, slugify } from "@/lib/format";
import { checkNewEvent, getUsage } from "@/lib/plans";
import { deleteObject } from "@/lib/s3";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export type ActionState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | null;

function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = String(i.path[0] ?? "form");
    out[k] ??= i.message;
  }
  return out;
}

// ---------------------------------------------------------------- onboarding

const StudioSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(80, "Keep it under 80 characters"),
});

export async function createStudio(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (await getStudio()) redirect("/app");
  const parsed = StudioSchema.safeParse({ name: form.get("name") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const sb = await supabaseServer();
  const { error } = await sb.from("studios").insert({ owner_id: user.id, name: parsed.data.name });
  if (error) return { error: "Couldn't create your studio. Try again." };
  redirect("/app/events/new");
}

// ---------------------------------------------------------------- events

const EventSchema = z
  .object({
    name: z.string().trim().min(2, "Give the event a name").max(120),
    event_date: z.iso.date().optional().or(z.literal("").transform(() => undefined)),
    visibility: z.enum(["public", "pin"]),
    pin: z.string().trim().optional(),
    expires_in_days: z.coerce.number().int().min(1).max(730),
  })
  .refine((v) => v.visibility === "public" || /^\d{4,8}$/.test(v.pin ?? ""), {
    message: "Use a 4–8 digit PIN",
    path: ["pin"],
  });

export async function createEvent(_: ActionState, form: FormData): Promise<ActionState> {
  const studio = await requireStudio();
  const parsed = EventSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const limit = checkNewEvent(await getUsage(studio));
  if (!limit.ok) return { error: limit.reason };
  const v = parsed.data;
  const sb = await supabaseServer();
  const base = slugify(v.name) || "event";
  let id: string | null = null;
  for (let attempt = 0; attempt < 5 && !id; attempt++) {
    const slug = `${base.slice(0, 40)}-${randomSuffix(attempt < 2 ? 4 : 6)}`;
    const { data, error } = await sb
      .from("events")
      .insert({
        studio_id: studio.id,
        name: v.name,
        slug,
        event_date: v.event_date ?? null,
        visibility: v.visibility,
        pin_hash: v.visibility === "pin" ? await hashPin(v.pin ?? "") : null,
        expires_at: new Date(Date.now() + v.expires_in_days * 86400_000).toISOString(),
      })
      .select("id")
      .single();
    if (data) id = data.id;
    else if (error && error.code !== "23505") return { error: "Couldn't create the event. Try again." };
  }
  if (!id) return { error: "Couldn't find a free link for this event. Try a different name." };
  await supabaseAdmin().from("audit_log").insert({ studio_id: studio.id, event_id: id, actor: "studio", action: "event.created" });
  redirect(`/app/events/${id}`);
}

const SettingsSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(2).max(120),
    event_date: z.iso.date().optional().or(z.literal("").transform(() => undefined)),
    visibility: z.enum(["public", "pin"]),
    pin: z.string().trim().optional(),
    allow_download: z.enum(["on"]).optional(),
    watermark: z.enum(["on"]).optional(),
    show_all_gallery: z.enum(["on"]).optional(),
    expires_at: z.iso.date(),
  })
  .refine((v) => v.visibility === "public" || !v.pin || /^\d{4,8}$/.test(v.pin), {
    message: "Use a 4–8 digit PIN",
    path: ["pin"],
  });

export async function updateEventSettings(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = SettingsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const ev = await requireOwnedEvent(v.id);
  if (v.visibility === "pin" && !v.pin && !ev.pin_hash) return { fieldErrors: { pin: "Set a PIN" } };
  const watermark = v.watermark === "on";
  const sb = await supabaseServer();
  const { error } = await sb
    .from("events")
    .update({
      name: v.name,
      event_date: v.event_date ?? null,
      visibility: v.visibility,
      pin_hash: v.visibility === "pin" ? (v.pin ? await hashPin(v.pin) : ev.pin_hash) : null,
      allow_download: v.allow_download === "on",
      watermark,
      show_all_gallery: v.show_all_gallery === "on",
      expires_at: new Date(`${v.expires_at}T23:59:59Z`).toISOString(),
    })
    .eq("id", ev.id);
  if (error) return { error: "Couldn't save. Try again." };
  if (watermark && !ev.watermark) {
    await supabaseAdmin()
      .from("jobs")
      .insert({ type: "rewatermark_event", payload: { event_id: ev.id }, dedupe_key: `wm:${ev.id}` });
  }
  revalidatePath(`/app/events/${ev.id}`);
  return { ok: true };
}

export async function deleteEvent(form: FormData): Promise<void> {
  const id = z.uuid().parse(form.get("id"));
  const confirm = String(form.get("confirm") ?? "");
  const ev = await requireOwnedEvent(id);
  if (confirm.trim() !== ev.name.trim()) redirect(`/app/events/${id}?tab=settings&delete=mismatch`);
  const admin = supabaseAdmin();
  await admin.rpc("request_event_deletion", { p_event_id: ev.id, p_reason: "studio" });
  await admin.from("audit_log").insert({ studio_id: ev.studio_id, event_id: ev.id, actor: "studio", action: "event.delete_requested" });
  revalidatePath("/app");
  redirect("/app?deleted=1");
}

export async function deletePhoto(form: FormData): Promise<void> {
  const photoId = z.uuid().parse(form.get("photo_id"));
  const eventId = z.uuid().parse(form.get("event_id"));
  await requireOwnedEvent(eventId);
  const sb = await supabaseServer();
  // RLS: only the owning studio can delete; faces cascade. Then hard-delete the files.
  const { data } = await sb
    .from("photos")
    .delete()
    .eq("id", photoId)
    .eq("event_id", eventId)
    .select("r2_key_original, r2_key_web, r2_key_web_wm, r2_key_thumb")
    .maybeSingle();
  if (data) {
    const keys = [data.r2_key_original, data.r2_key_web, data.r2_key_web_wm, data.r2_key_thumb];
    await Promise.all(keys.filter((k): k is string => !!k).map((k) => deleteObject(k).catch(() => undefined)));
  }
  await supabaseAdmin().rpc("refresh_event_stats", { p_event_id: eventId });
  revalidatePath(`/app/events/${eventId}`);
}

// ---------------------------------------------------------------- brand

const BrandSchema = z.object({
  name: z.string().trim().min(2).max(80),
  brand_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex colour like #FF8A3D"),
});

export async function updateBrand(_: ActionState, form: FormData): Promise<ActionState> {
  const studio = await requireStudio();
  const parsed = BrandSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const custom = studio.plan === "pro" || studio.plan === "studio";
  const sb = await supabaseServer();
  const { error } = await sb
    .from("studios")
    .update({ name: parsed.data.name, ...(custom ? { brand_color: parsed.data.brand_color.toUpperCase() } : {}) })
    .eq("id", studio.id);
  if (error) return { error: "Couldn't save. Try again." };
  revalidatePath("/app/brand");
  return { ok: true };
}
