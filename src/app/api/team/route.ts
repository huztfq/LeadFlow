import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toInviteSummary, toUserSummary } from "@/lib/team";

/** Owner-only: everyone with an account, plus pending (unaccepted) invites. */
export async function GET(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "You don't have access to manage the team" }, { status: 403 });
  }

  const [members, invites] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.invite.findMany({ where: { acceptedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);

  return NextResponse.json({
    members: members.map(toUserSummary),
    invites: invites.map(toInviteSummary),
  });
}
