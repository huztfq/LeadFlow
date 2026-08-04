import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { getResend } from "@/lib/resend";
import { renderInviteEmail } from "@/lib/email-templates";
import type { Invite, User } from "@/generated/prisma/client";

const INVITE_TTL_DAYS = 7;

/**
 * Starting credit limits for accounts invited straight from the waitlist
 * (Oversight → Allow) rather than an owner picking limits by hand. Modest
 * enough to bound spend during the private beta; the owner can raise/lower
 * them later from /settings/team.
 */
export const WAITLIST_DEFAULT_APOLLO_CREDIT_LIMIT = 50;
export const WAITLIST_DEFAULT_AI_CREDIT_LIMIT = 200;

export function generateInviteToken(): string {
  return randomBytes(24).toString("hex");
}

export function inviteExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Ensures a single `owner` user exists, creating one on first successful
 * APP_PASSWORD login. Safe to call repeatedly — subsequent calls just return
 * the existing owner. `OWNER_EMAIL` (optional) seeds the owner's email;
 * otherwise falls back to a synthetic local address.
 */
export async function ensureOwnerUser(): Promise<User> {
  const existingOwner = await prisma.user.findFirst({ where: { role: "owner" } });
  if (existingOwner) return existingOwner;

  const email = (process.env.OWNER_EMAIL ?? "owner@leadflow.local").trim().toLowerCase();

  // The owner may already exist as a plain row (e.g. re-run after a partial
  // failure, or OWNER_EMAIL changed to match an already-invited address) —
  // promote rather than violate the unique email constraint.
  const existingByEmail = await prisma.user.findUnique({ where: { email } });
  if (existingByEmail) {
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: { role: "owner", acceptedAt: existingByEmail.acceptedAt ?? new Date() },
    });
  }

  return prisma.user.create({
    data: { email, role: "owner", acceptedAt: new Date() },
  });
}

export type UserSummary = {
  id: string;
  email: string;
  name: string | null;
  role: "owner" | "member";
  apolloCreditLimit: number | null;
  apolloCreditsUsed: number;
  aiCreditLimit: number | null;
  aiCreditsUsed: number;
  invitedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
};

export function toUserSummary(user: User): UserSummary {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    apolloCreditLimit: user.apolloCreditLimit,
    apolloCreditsUsed: user.apolloCreditsUsed,
    aiCreditLimit: user.aiCreditLimit,
    aiCreditsUsed: user.aiCreditsUsed,
    invitedAt: user.invitedAt?.toISOString() ?? null,
    acceptedAt: user.acceptedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

export type InviteSummary = {
  id: string;
  email: string;
  apolloCreditLimit: number | null;
  aiCreditLimit: number | null;
  expiresAt: string;
  expired: boolean;
  createdAt: string;
};

export function toInviteSummary(invite: Invite): InviteSummary {
  return {
    id: invite.id,
    email: invite.email,
    apolloCreditLimit: invite.apolloCreditLimit,
    aiCreditLimit: invite.aiCreditLimit,
    expiresAt: invite.expiresAt.toISOString(),
    expired: invite.expiresAt.getTime() < Date.now(),
    createdAt: invite.createdAt.toISOString(),
  };
}

export class CreditLimitExceededError extends Error {
  constructor(public kind: "apollo" | "ai") {
    super(
      kind === "apollo"
        ? "Apollo credit limit reached. Ask your team to raise your limit."
        : "AI credit limit reached. Ask your team to raise your limit.",
    );
  }
}

/** Throws `CreditLimitExceededError` if the user has no remaining Apollo credits. */
export function assertApolloCreditsAvailable(user: User): void {
  if (user.apolloCreditLimit === null) return;
  if (user.apolloCreditsUsed >= user.apolloCreditLimit) {
    throw new CreditLimitExceededError("apollo");
  }
}

/**
 * Throws `CreditLimitExceededError` if the user has no remaining AI credits.
 * The APP_PASSWORD-authenticated account (`role: "owner"`) has no AI credit
 * pool at all — always unlimited, regardless of any `aiCreditLimit` value.
 */
export function assertAiCreditsAvailable(user: User): void {
  if (user.role === "owner") return;
  if (user.aiCreditLimit === null) return;
  if (user.aiCreditsUsed >= user.aiCreditLimit) {
    throw new CreditLimitExceededError("ai");
  }
}

/** Increments Apollo usage by `count` (e.g. people actually enriched). */
export async function consumeApolloCredits(userId: string, count: number): Promise<void> {
  if (count <= 0) return;
  await prisma.user.update({
    where: { id: userId },
    data: { apolloCreditsUsed: { increment: count } },
  });
}

/**
 * Increments AI usage by `count` (v1: +1 per chat/execute request). No-op for
 * `role: "owner"` — see `assertAiCreditsAvailable`.
 */
export async function consumeAiCredits(user: User, count = 1): Promise<void> {
  if (user.role === "owner" || count <= 0) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { aiCreditsUsed: { increment: count } },
  });
}

export function buildInviteLink(token: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/invite/${token}`;
}

/**
 * Best-effort invite email via Resend. Returns whether it actually sent —
 * callers should always also surface the invite link in the UI, since Resend
 * isn't guaranteed to be configured (no `RESEND_API_KEY`/`RESEND_FROM_EMAIL`)
 * and sandbox sending domains can only mail the account owner.
 */
export async function sendInviteEmail(
  email: string,
  link: string,
  opts: { expiresAt: Date },
): Promise<{ sent: boolean; error?: string }> {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!process.env.RESEND_API_KEY || !from) {
    return { sent: false, error: "RESEND_API_KEY / RESEND_FROM_EMAIL not configured" };
  }

  const { subject, html, text } = renderInviteEmail({
    inviteeEmail: email,
    acceptUrl: link,
    expiresAt: opts.expiresAt,
  });

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject,
      html,
      text,
    });
    if (error) return { sent: false, error: error.message };
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "Failed to send invite email" };
  }
}
