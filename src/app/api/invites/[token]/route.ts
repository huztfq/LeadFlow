import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ token: string }> };

/** Public: lets the accept-invite page show who the invite is for before a password is set. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { token } = await params;

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  return NextResponse.json({
    email: invite.email,
    accepted: invite.acceptedAt !== null,
    expired: invite.expiresAt.getTime() < Date.now(),
  });
}
