import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { buildGoogleAuthUrl, createOAuthState, isGoogleCalendarConfigured } from "@/lib/calendar-google";

export async function GET(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json(
      { error: "Google Calendar isn't configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI." },
      { status: 400 },
    );
  }

  const state = createOAuthState();
  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
