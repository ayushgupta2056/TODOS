import "server-only";
import { supabaseAdmin } from "./supabase/server";

/** Fixed-window limiter backed by Postgres (reliable on Workers, free). Fails open on DB errors. */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("hit_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) return true;
  return data === true;
}
