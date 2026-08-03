import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CALENDAR_CONNECTION_ID, summarizeConnection } from "@/lib/calendar";
import { isGoogleCalendarConfigured } from "@/lib/calendar-google";
import { CalendarProvider } from "@/generated/prisma/enums";

export async function GET(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await prisma.calendarConnection.findUnique({ where: { id: CALENDAR_CONNECTION_ID } });
  return NextResponse.json({
    connection: summarizeConnection(connection),
    googleConfigured: isGoogleCalendarConfigured(),
  });
}

const putSchema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("ical"), icalUrl: z.string().trim().url(), label: z.string().trim().optional() }),
  z.object({ provider: z.literal("link"), bookingUrl: z.string().trim().url(), label: z.string().trim().optional() }),
]);

export async function PUT(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid connection data", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const connection = await prisma.calendarConnection.upsert({
    where: { id: CALENDAR_CONNECTION_ID },
    create: {
      id: CALENDAR_CONNECTION_ID,
      provider: data.provider === "ical" ? CalendarProvider.ical : CalendarProvider.link,
      label: data.label ?? null,
      icalUrl: data.provider === "ical" ? data.icalUrl : null,
      bookingUrl: data.provider === "link" ? data.bookingUrl : null,
    },
    update: {
      provider: data.provider === "ical" ? CalendarProvider.ical : CalendarProvider.link,
      label: data.label ?? null,
      icalUrl: data.provider === "ical" ? data.icalUrl : null,
      bookingUrl: data.provider === "link" ? data.bookingUrl : null,
      googleEmail: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
    },
  });

  return NextResponse.json({ connection: summarizeConnection(connection) });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.calendarConnection.deleteMany({ where: { id: CALENDAR_CONNECTION_ID } });
  return NextResponse.json({ ok: true });
}
