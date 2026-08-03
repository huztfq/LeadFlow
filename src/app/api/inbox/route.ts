import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { INBOX_CATEGORIES } from "@/lib/inbox-category";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const unreadOnly = searchParams.get("unread") === "1";

  const where: Prisma.InboxMessageWhereInput = {};
  if (category && (INBOX_CATEGORIES as readonly string[]).includes(category)) {
    where.category = category as (typeof INBOX_CATEGORIES)[number];
  }
  if (unreadOnly) {
    where.readAt = null;
  }

  const messages = await prisma.inboxMessage.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    take: 100,
    include: {
      lead: { select: { firstName: true, lastName: true, company: true } },
      campaign: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    messages: messages.map((message) => ({
      id: message.id,
      fromEmail: message.fromEmail,
      toEmail: message.toEmail,
      subject: message.subject,
      bodyText: message.bodyText,
      bodyHtml: message.bodyHtml,
      category: message.category,
      categoryConfidence: message.categoryConfidence,
      categorySource: message.categorySource,
      receivedAt: message.receivedAt,
      readAt: message.readAt,
      leadName: message.lead ? [message.lead.firstName, message.lead.lastName].filter(Boolean).join(" ") || null : null,
      leadCompany: message.lead?.company ?? null,
      campaign: message.campaign,
    })),
  });
}
