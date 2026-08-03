import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CALENDAR_CONNECTION_ID } from "@/lib/calendar";
import { exchangeGoogleCode, fetchGoogleEmail, verifyOAuthState } from "@/lib/calendar-google";
import { CalendarProvider } from "@/generated/prisma/enums";

function redirectToCalendar(request: NextRequest, status: "connected" | "error", message?: string) {
  const url = new URL("/calendar", request.url);
  url.searchParams.set("google", status);
  if (message) url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  if (error) {
    return redirectToCalendar(request, "error", error);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !verifyOAuthState(state)) {
    return redirectToCalendar(request, "error", "Invalid or expired OAuth state");
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    const email = await fetchGoogleEmail(tokens.access_token);

    await prisma.calendarConnection.upsert({
      where: { id: CALENDAR_CONNECTION_ID },
      create: {
        id: CALENDAR_CONNECTION_ID,
        provider: CalendarProvider.google,
        googleEmail: email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
      update: {
        provider: CalendarProvider.google,
        googleEmail: email,
        accessToken: tokens.access_token,
        // Google only returns refresh_token on the first consent grant; keep
        // the existing one on re-connects unless a new one is issued.
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        icalUrl: null,
        bookingUrl: null,
      },
    });

    return redirectToCalendar(request, "connected");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to connect Google Calendar";
    return redirectToCalendar(request, "error", message);
  }
}
