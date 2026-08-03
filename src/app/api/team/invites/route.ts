import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buildInviteLink,
  generateInviteToken,
  inviteExpiresAt,
  sendInviteEmail,
  toInviteSummary,
} from "@/lib/team";

const createInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  apolloCreditLimit: z.number().int().min(0).nullable().optional(),
  aiCreditLimit: z.number().int().min(0).nullable().optional(),
});

/** Owner-only: invite a new email with Apollo/AI credit limits. */
export async function POST(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "You don't have access to manage the team" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid invite data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, apolloCreditLimit, aiCreditLimit } = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "That email already has an account" }, { status: 409 });
  }

  // Re-inviting an email replaces its still-pending invite rather than
  // stacking multiple live tokens for the same address.
  await prisma.invite.deleteMany({ where: { email, acceptedAt: null } });

  const invite = await prisma.invite.create({
    data: {
      email,
      token: generateInviteToken(),
      apolloCreditLimit: apolloCreditLimit ?? null,
      aiCreditLimit: aiCreditLimit ?? null,
      invitedById: owner.id,
      expiresAt: inviteExpiresAt(),
    },
  });

  const link = buildInviteLink(invite.token);
  const emailResult = await sendInviteEmail(email, link, {
    inviterName: owner.name,
    inviterEmail: owner.email,
    expiresAt: invite.expiresAt,
  });

  return NextResponse.json({
    invite: toInviteSummary(invite),
    link,
    emailSent: emailResult.sent,
    emailError: emailResult.sent ? undefined : emailResult.error,
  });
}
