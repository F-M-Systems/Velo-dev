import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient, safeNext } from "@/lib/supabase";

// Landing point for links in auth emails (signup confirmation, password recovery).
// token_hash links work on any device; ?code= links only in the browser that started the flow.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();
  const { error } =
    tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : code
        ? await supabase.auth.exchangeCodeForSession(code)
        : { error: new Error("missing token") };

  const path = error ? "/login?error=link_invalid" : safeNext(searchParams.get("next"));
  return NextResponse.redirect(new URL(path, request.url));
}
