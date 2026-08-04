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
  WAITLIST_DEFAULT_AI_CREDIT_LIMIT,
  WAITLIST_DEFAULT_APOLLO_CREDIT_LIMIT,
} from "@/lib/team";

type RouteContext = { params: Promise<{ id: string }> };

const allowSchema = z.object({
  apolloCreditLimit: z.number().int().min(0).nullable().optional(),
  aiCreditLimit: z.number().int().min(0).nullable().optional(),
});

/**
 * Owner-only: mark a waitlist signup `allowed` and invite that email to the
 * team — reusing the same invite flow as POST /api/team/invites (deletes any
 * still-pending invite for the email, creates a new one, best-effort emails
 * it) — with sensible default credit limits unless the request overrides
 * them. If the email already has an account, just flips the waitlist status
 * without creating a duplicate invite.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "You don't have access to Oversight" }, { status: 403 });
  }

  const { id } = await params;
  const signup = await prisma.waitlistSignup.findUnique({ where: { id } });
  if (!signup) {
    return NextResponse.json({ error: "Waitlist signup not found" }, { status: 404 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = allowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid credit limits", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const apolloCreditLimit = parsed.data.apolloCreditLimit ?? WAITLIST_DEFAULT_APOLLO_CREDIT_LIMIT;
  const aiCreditLimit = parsed.data.aiCreditLimit ?? WAITLIST_DEFAULT_AI_CREDIT_LIMIT;

  const existingUser = await prisma.user.findUnique({ where: { email: signup.email } });
  if (existingUser) {
    await prisma.waitlistSignup.update({ where: { id }, data: { status: "allowed" } });
    return NextResponse.json({ ok: true, alreadyHasAccount: true });
  }

  await prisma.waitlistSignup.update({ where: { id }, data: { status: "allowed" } });
  await prisma.invite.deleteMany({ where: { email: signup.email, acceptedAt: null } });

  const invite = await prisma.invite.create({
    data: {
      email: signup.email,
      token: generateInviteToken(),
      apolloCreditLimit,
      aiCreditLimit,
      invitedById: owner.id,
      expiresAt: inviteExpiresAt(),
    },
  });

  const link = buildInviteLink(invite.token);
  const emailResult = await sendInviteEmail(signup.email, link, { expiresAt: invite.expiresAt });

  return NextResponse.json({
    ok: true,
    invite: toInviteSummary(invite),
    link,
    emailSent: emailResult.sent,
    emailError: emailResult.sent ? undefined : emailResult.error,
  });
}
