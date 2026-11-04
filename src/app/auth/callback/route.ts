import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for email confirmation and magic links (PKCE). Exchanges the one-time code for a
 * session cookie, then continues to a same-site path only.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
    console.error("Auth code exchange failed", { code: error.code, status: error.status });
  }

  const failure = new URL("/sign-in", origin);
  failure.searchParams.set("error", "link");
  return NextResponse.redirect(failure);
}
