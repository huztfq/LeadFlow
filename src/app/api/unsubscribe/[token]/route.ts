import { NextRequest, NextResponse } from "next/server";
import { EnrollmentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { cancelScheduledEmails } from "@/lib/resend";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

type RouteContext = { params: Promise<{ token: string }> };

async function unsubscribe(token: string): Promise<void> {
  const enrollmentId = verifyUnsubscribeToken(token);
  if (!enrollmentId) return;

  await prisma.enrollment.updateMany({
    where: { id: enrollmentId },
    data: { status: EnrollmentStatus.unsubscribed },
  });

  // Follow-ups queued in Resend at send time must not go out after an opt-out.
  const pending = await prisma.sendLog.findMany({
    where: { enrollmentId, status: "sent", sentAt: { gt: new Date() }, resendId: { not: null } },
    select: { id: true, resendId: true },
  });
  if (pending.length === 0) return;

  const canceled = new Set(await cancelScheduledEmails(pending.map((p) => p.resendId!)));
  await prisma.sendLog.updateMany({
    where: { id: { in: pending.filter((p) => canceled.has(p.resendId!)).map((p) => p.id) } },
    data: { status: "canceled" },
  });
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  await unsubscribe(token);
  return NextResponse.redirect(new URL("/unsubscribed", request.url));
}

/** RFC 8058 one-click unsubscribe (List-Unsubscribe-Post) from Gmail/Yahoo. */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  await unsubscribe(token);
  return new NextResponse(null, { status: 200 });
}
