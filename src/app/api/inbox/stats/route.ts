import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [sent, opened, repliedEnrollments, categoryCounts] = await Promise.all([
    prisma.sendLog.count({ where: { status: "sent" } }),
    prisma.sendLog.count({ where: { status: "sent", openedAt: { not: null } } }),
    prisma.sendLog.count({ where: { status: "sent", repliedAt: { not: null } } }),
    prisma.inboxMessage.groupBy({ by: ["category"], _count: { _all: true } }),
  ]);

  const byCategory = Object.fromEntries(categoryCounts.map((row) => [row.category, row._count._all]));

  return NextResponse.json({
    sent,
    opened,
    replied: repliedEnrollments,
    interested: byCategory.interested ?? 0,
    booked: byCategory.booked ?? 0,
    notInterested: byCategory.not_interested ?? 0,
    question: byCategory.question ?? 0,
    unsubscribe: byCategory.unsubscribe ?? 0,
  });
}
