import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

/** Owner-only: rescind a pending invite. */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "You don't have access to manage the team" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.invite.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
