import "server-only";
import type { PlanTier, Row } from "@glimpse/db";
import { supabaseAdmin } from "./supabase/server";

export type Plan = Row<"plans">;

// Mirrors the seed in packages/db migrations; used only if the DB is unreachable (e.g. CI builds).
const FALLBACK_PLANS: Plan[] = [
  { id: "trial", name: "Free trial", price_inr_monthly: 0, photos_per_month: 500, storage_gb: 2, active_events: 1, custom_branding: false, sort: 0 },
  { id: "starter", name: "Starter", price_inr_monthly: 999, photos_per_month: 5000, storage_gb: 50, active_events: 3, custom_branding: false, sort: 1 },
  { id: "pro", name: "Pro", price_inr_monthly: 2499, photos_per_month: 25000, storage_gb: 250, active_events: 10, custom_branding: true, sort: 2 },
  { id: "studio", name: "Studio", price_inr_monthly: 5999, photos_per_month: 100000, storage_gb: 1000, active_events: null, custom_branding: true, sort: 3 },
];

export async function getPlans(): Promise<Plan[]> {
  try {
    const { data, error } = await supabaseAdmin().from("plans").select("*").order("sort");
    if (error || !data?.length) return FALLBACK_PLANS;
    return data;
  } catch {
    return FALLBACK_PLANS;
  }
}

export async function getPlan(tier: PlanTier): Promise<Plan> {
  const { data, error } = await supabaseAdmin().from("plans").select("*").eq("id", tier).single();
  if (error) throw error;
  return data;
}

export interface UsageSnapshot {
  plan: Plan;
  photosThisMonth: number;
  storageBytes: number;
  activeEvents: number;
}

export async function getUsage(studio: Row<"studios">): Promise<UsageSnapshot> {
  const admin = supabaseAdmin();
  const month = new Date();
  const monthKey = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const [plan, usage, storage, events] = await Promise.all([
    getPlan(studio.plan),
    admin.from("usage").select("photos_uploaded").eq("studio_id", studio.id).eq("month", monthKey).maybeSingle(),
    admin.rpc("studio_storage_bytes", { p_studio_id: studio.id }),
    admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studio.id)
      .eq("status", "live"),
  ]);
  // The trial's photo allowance is lifetime, not monthly.
  let photos = usage.data?.photos_uploaded ?? 0;
  if (studio.plan === "trial") {
    const { count } = await admin
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studio.id);
    photos = count ?? 0;
  }
  return {
    plan,
    photosThisMonth: photos,
    storageBytes: Number(storage.data ?? 0),
    activeEvents: events.count ?? 0,
  };
}

export type LimitCheck = { ok: true } | { ok: false; reason: string };

export function checkUpload(u: UsageSnapshot, files: number, bytes: number): LimitCheck {
  if (u.photosThisMonth + files > u.plan.photos_per_month) {
    const left = Math.max(0, u.plan.photos_per_month - u.photosThisMonth);
    return {
      ok: false,
      reason: `Your ${u.plan.name} plan allows ${u.plan.photos_per_month.toLocaleString("en-IN")} photos${u.plan.id === "trial" ? "" : " a month"}. ${left.toLocaleString("en-IN")} left.`,
    };
  }
  if (u.storageBytes + bytes > u.plan.storage_gb * 1024 ** 3) {
    return { ok: false, reason: `This would exceed your ${u.plan.storage_gb} GB of storage.` };
  }
  return { ok: true };
}

export function checkNewEvent(u: UsageSnapshot): LimitCheck {
  if (u.plan.active_events !== null && u.activeEvents >= u.plan.active_events) {
    return {
      ok: false,
      reason: `Your ${u.plan.name} plan includes ${u.plan.active_events} active event${u.plan.active_events === 1 ? "" : "s"}. Archive one or upgrade.`,
    };
  }
  return { ok: true };
}
