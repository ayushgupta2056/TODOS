import { type NextRequest, NextResponse } from "next/server";
import { publicOrigin } from "@/lib/origin";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const nextParam = url.searchParams.get("next") ?? "/app";
  const next = nextParam.startsWith("/app") ? nextParam : "/app";
  const sb = await supabaseServer();
  let ok = false;
  if (code) {
    ok = !(await sb.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && (type === "magiclink" || type === "email" || type === "signup")) {
    ok = !(await sb.auth.verifyOtp({ token_hash: tokenHash, type: type === "signup" ? "signup" : "email" })).error;
  }
  return NextResponse.redirect(new URL(ok ? next : "/login?error=link", publicOrigin(url.origin)));
}
