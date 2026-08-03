import { NextRequest, NextResponse } from "next/server";
import { createOAuthState } from "@/lib/calendar-google";
import { buildGoogleLoginAuthUrl, isGoogleLoginConfigured } from "@/lib/google-login";

/** Public: starts "Sign in with Google" from the login page. Invite-only — see the callback. */
export function GET(request: NextRequest) {
  if (!isGoogleLoginConfigured()) {
    const url = new URL("/login", request.url);
    url.searchParams.set("googleError", "not_configured");
    return NextResponse.redirect(url);
  }

  const state = createOAuthState();
  return NextResponse.redirect(buildGoogleLoginAuthUrl(state));
}
