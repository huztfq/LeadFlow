import { NextRequest, NextResponse } from "next/server";
import { EnrollmentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;
  const enrollmentId = verifyUnsubscribeToken(token);

  if (enrollmentId) {
    await prisma.enrollment.updateMany({
      where: { id: enrollmentId },
      data: { status: EnrollmentStatus.unsubscribed },
    });
  }

  return NextResponse.redirect(new URL("/unsubscribed", request.url));
}
