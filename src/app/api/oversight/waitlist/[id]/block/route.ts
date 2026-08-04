import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Owner-only: mark a waitlist signup `blocked`. No invite is created or
 * sent. Re-submitting the waitlist form with this email afterward (see
 * POST /api/waitlist) never flips the status back to `pending` — only an
 * owner can change it here.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "You don't have access to Oversight" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.waitlistSignup.update({ where: { id }, data: { status: "blocked" } });
  } catch {
    return NextResponse.json({ error: "Waitlist signup not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
