"use client";

import type { Database } from "@glimpse/db";
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "../public-env";
import { AUTH_COOKIE } from "./cookie";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function supabaseBrowser() {
  client ??= createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookieOptions: { name: AUTH_COOKIE },
  });
  return client;
}
