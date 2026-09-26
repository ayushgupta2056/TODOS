// Values inlined into the browser bundle. Keep this list tiny.
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  googleAuth: process.env.NEXT_PUBLIC_GOOGLE_AUTH === "true",
};
