import "server-only";
import type { Row } from "@glimpse/db";
import { redirect } from "next/navigation";
import { cache } from "react";
import { supabaseServer } from "./supabase/server";

export const getUser = cache(async () => {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  return data.user;
});

export const getStudio = cache(async (): Promise<Row<"studios"> | null> => {
  const user = await getUser();
  if (!user) return null;
  const sb = await supabaseServer();
  const { data } = await sb.from("studios").select("*").eq("owner_id", user.id).maybeSingle();
  return data;
});

/** For photographer pages: signed in and onboarded, else redirect. */
export async function requireStudio(): Promise<Row<"studios">> {
  const user = await getUser();
  if (!user) redirect("/login");
  const studio = await getStudio();
  if (!studio) redirect("/app/onboarding");
  return studio;
}

/** Returns the event if (and only if) it belongs to the signed-in studio. */
export async function requireOwnedEvent(eventId: string): Promise<Row<"events">> {
  const studio = await requireStudio();
  const sb = await supabaseServer();
  const { data } = await sb
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("studio_id", studio.id)
    .neq("status", "deleting")
    .maybeSingle();
  if (!data) redirect("/app");
  return data;
}
