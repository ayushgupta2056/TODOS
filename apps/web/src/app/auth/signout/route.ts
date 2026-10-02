import { type NextRequest, NextResponse } from "next/server";
import { publicOrigin } from "@/lib/origin";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  return NextResponse.redirect(new URL("/", publicOrigin(request.nextUrl.origin)), { status: 303 });
}
