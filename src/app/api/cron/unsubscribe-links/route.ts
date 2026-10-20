import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signUnsubscribeToken } from "@/lib/unsubscribe";

// Lets out-of-band send scripts mail links signed with production's UNSUBSCRIBE_SECRET.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const appUrl = process.env.APP_URL;
  if (!appUrl) return NextResponse.json({ error: "APP_URL is not set" }, { status: 500 });

  const body = (await request.json().catch(() => null)) as { enrollmentIds?: unknown } | null;
  const ids = Array.isArray(body?.enrollmentIds)
    ? body.enrollmentIds.filter((id): id is string => typeof id === "string").slice(0, 500)
    : [];
  const existing = await prisma.enrollment.findMany({ where: { id: { in: ids } }, select: { id: true } });

  const links = Object.fromEntries(
    existing.map(({ id }) => [id, `${appUrl}/api/unsubscribe/${signUnsubscribeToken(id)}`]),
  );
  return NextResponse.json({ links });
}
