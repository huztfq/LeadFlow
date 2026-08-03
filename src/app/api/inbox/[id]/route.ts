import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { INBOX_CATEGORIES } from "@/lib/inbox-category";

const patchSchema = z.object({
  read: z.boolean().optional(),
  category: z.enum(INBOX_CATEGORIES).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update", details: parsed.error.flatten() }, { status: 400 });
  }

  const { read, category } = parsed.data;
  if (read === undefined && category === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const existing = await prisma.inboxMessage.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const message = await prisma.inboxMessage.update({
    where: { id },
    data: {
      ...(read !== undefined ? { readAt: read ? new Date() : null } : {}),
      ...(category !== undefined
        ? { category, categorySource: "manual", categoryConfidence: 1 }
        : {}),
    },
  });

  return NextResponse.json({ message });
}
