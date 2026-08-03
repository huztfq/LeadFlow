import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUpcomingEvents } from "@/lib/calendar";

export async function GET(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getUpcomingEvents(30);
  return NextResponse.json(result);
}

const createEventSchema = z.object({
  title: z.string().trim().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  description: z.string().trim().optional(),
  location: z.string().trim().optional(),
  leadId: z.string().trim().optional(),
  inboxMessageId: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { title, startAt, endAt, description, location, leadId, inboxMessageId } = parsed.data;

  const data = {
    title,
    startAt: new Date(startAt),
    endAt: endAt ? new Date(endAt) : null,
    description: description ?? null,
    location: location ?? null,
    leadId: leadId ?? null,
  };

  // Idempotent per inbox message so re-clicking "Add to calendar" doesn't
  // create duplicates (inboxMessageId is unique).
  const event = inboxMessageId
    ? await prisma.calendarEvent.upsert({
        where: { inboxMessageId },
        create: { ...data, inboxMessageId },
        update: data,
      })
    : await prisma.calendarEvent.create({ data });

  return NextResponse.json({ event }, { status: 201 });
}
