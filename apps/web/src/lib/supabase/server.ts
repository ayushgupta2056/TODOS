import "server-only";
import type { Database } from "@glimpse/db";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "../env";
import { AUTH_COOKIE } from "./cookie";

/** Per-request client acting as the signed-in photographer (RLS applies). */
export async function supabaseServer() {
  const store = await cookies();
  const e = env();
  return createServerClient<Database>(e.SUPABASE_URL ?? e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookieOptions: { name: AUTH_COOKIE },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: the proxy refreshes sessions instead.
        }
      },
    },
  });
}

let admin: ReturnType<typeof createClient<Database>> | undefined;

/** Service-role client. Server only. Bypasses RLS: every call site must check access first. */
export function supabaseAdmin() {
  if (admin) return admin;
  const e = env();
  admin = createClient<Database>(e.SUPABASE_URL ?? e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
