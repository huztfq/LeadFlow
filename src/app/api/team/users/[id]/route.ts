import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toUserSummary } from "@/lib/team";

type RouteContext = { params: Promise<{ id: string }> };

const updateUserSchema = z.object({
  apolloCreditLimit: z.number().int().min(0).nullable().optional(),
  aiCreditLimit: z.number().int().min(0).nullable().optional(),
});

/** Owner-only: update a member's Apollo/AI credit limits. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "You don't have access to manage the team" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.apolloCreditLimit === undefined && parsed.data.aiCreditLimit === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        apolloCreditLimit: parsed.data.apolloCreditLimit,
        aiCreditLimit: parsed.data.aiCreditLimit,
      },
    });
    return NextResponse.json({ user: toUserSummary(user) });
  } catch {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
}
