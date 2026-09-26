import "server-only";
import type React from "react";
import type { Row } from "@glimpse/db";
import { cookies, headers } from "next/headers";
import { env } from "./env";
import { sha256Hex, signToken, verifyToken } from "./crypto";
import { supabaseAdmin } from "./supabase/server";

export const CONSENT_VERSION = "2026-09-v1";
const TTL_S = 60 * 60 * 24; // guest cookie lifetime

export interface GuestToken {
  e: string; // event id
  s?: string; // guest_session id (after consent)
  p?: 1; // PIN verified
  exp: number;
}

function cookieName(eventId: string): string {
  return `g_${eventId.replace(/-/g, "").slice(0, 16)}`;
}

export type PublicEvent = Pick<
  Row<"events">,
  | "id"
  | "slug"
  | "name"
  | "event_date"
  | "cover_key"
  | "visibility"
  | "allow_download"
  | "watermark"
  | "show_all_gallery"
  | "expires_at"
  | "status"
  | "studio_id"
  | "processed_count"
  | "photo_count"
> & { studio_name: string; brand_color: string; brand_logo_key: string | null; custom_branding: boolean };

export async function getPublicEvent(slug: string): Promise<PublicEvent | null> {
  const { data } = await supabaseAdmin()
    .from("events")
    .select(
      "id, slug, name, event_date, cover_key, visibility, allow_download, watermark, show_all_gallery, expires_at, status, studio_id, processed_count, photo_count, studios!inner(name, brand_color, brand_logo_key, plan)",
    )
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) <= new Date()) return null;
  const { studios, ...ev } = data;
  const custom = studios.plan === "pro" || studios.plan === "studio";
  return {
    ...ev,
    studio_name: studios.name,
    brand_color: custom ? studios.brand_color : "#FF8A3D",
    brand_logo_key: custom ? studios.brand_logo_key : null,
    custom_branding: custom,
  };
}

export async function readGuest(eventId: string): Promise<GuestToken | null> {
  const store = await cookies();
  const t = await verifyToken<GuestToken>(store.get(cookieName(eventId))?.value, env().GUEST_SECRET);
  if (!t || t.e !== eventId || t.exp < Date.now() / 1000) return null;
  return t;
}

export async function writeGuest(eventId: string, patch: Partial<Omit<GuestToken, "e" | "exp">>): Promise<void> {
  const current = (await readGuest(eventId)) ?? { e: eventId, exp: 0 };
  const next: GuestToken = { ...current, ...patch, e: eventId, exp: Math.floor(Date.now() / 1000) + TTL_S };
  const store = await cookies();
  store.set(cookieName(eventId), await signToken(next, env().GUEST_SECRET), {
    httpOnly: true,
    secure: env().APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: TTL_S,
  });
}

export async function clearGuest(eventId: string): Promise<void> {
  (await cookies()).delete(cookieName(eventId));
}

/** Does this visitor pass the event's PIN gate? */
export async function hasEventAccess(ev: PublicEvent): Promise<boolean> {
  if (ev.visibility === "public") return true;
  return (await readGuest(ev.id))?.p === 1;
}

export async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip =
    h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  // Salted so the stored value can't be reversed to an IP.
  return (await sha256Hex(`${env().GUEST_SECRET}:${ip}`)).slice(0, 32);
}

export interface GuestMatches {
  sessionId: string;
  photoIds: string[];
  searchedAt: string | null;
}

/** The current guest's consented session and (if still fresh) their matched photo ids. */
export async function getGuestMatches(eventId: string): Promise<GuestMatches | null> {
  const g = await readGuest(eventId);
  if (!g?.s) return null;
  const { data } = await supabaseAdmin()
    .from("guest_sessions")
    .select("id, matched_photo_ids, matches_expire_at, searched_at")
    .eq("id", g.s)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!data) return null;
  const fresh = data.matches_expire_at && new Date(data.matches_expire_at) > new Date();
  return { sessionId: data.id, photoIds: fresh ? (data.matched_photo_ids ?? []) : [], searchedAt: data.searched_at };
}

/** Accent override for studios with custom branding. Picks readable text on the accent. */
export function brandStyle(ev: PublicEvent): React.CSSProperties | undefined {
  if (!ev.custom_branding || ev.brand_color.toUpperCase() === "#FF8A3D") return undefined;
  const hex = ev.brand_color.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return {
    ["--amber" as string]: ev.brand_color,
    ["--amber-hover" as string]: ev.brand_color,
    ["--amber-press" as string]: ev.brand_color,
    ["--amber-ink" as string]: L > 0.35 ? "#0E0C0A" : "#FFFFFF",
    ["--amber-soft" as string]: `${ev.brand_color}22`,
  };
}
