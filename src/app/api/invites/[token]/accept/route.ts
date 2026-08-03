import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";

type RouteContext = { params: Promise<{ token: string }> };

const acceptSchema = z.object({
  password: z.string().min(8, "Use at least 8 characters"),
  name: z.string().trim().max(120).optional(),
});

/**
 * Public: consumes an invite token, sets the member's password, and signs
 * them in. Creates the `User` row here (not at invite-time) so a rescinded
 * invite never leaves behind an account.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { token } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid signup data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.acceptedAt) {
    return NextResponse.json({ error: "Invite already used" }, { status: 409 });
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const now = new Date();

  const user = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email: invite.email } });
    const created = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            name: parsed.data.name ?? existing.name,
            apolloCreditLimit: invite.apolloCreditLimit,
            aiCreditLimit: invite.aiCreditLimit,
            acceptedAt: existing.acceptedAt ?? now,
          },
        })
      : await tx.user.create({
          data: {
            email: invite.email,
            name: parsed.data.name,
            passwordHash,
            role: "member",
            apolloCreditLimit: invite.apolloCreditLimit,
            aiCreditLimit: invite.aiCreditLimit,
            invitedAt: invite.createdAt,
            acceptedAt: now,
          },
        });

    await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: now } });
    return created;
  });

  const sessionToken = await createSessionToken(user.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
