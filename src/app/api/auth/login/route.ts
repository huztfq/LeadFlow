import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { ensureOwnerUser } from "@/lib/team";
import { prisma } from "@/lib/db";

function passwordsMatch(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);

  if (providedBuf.length !== expectedBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }

  return timingSafeEqual(providedBuf, expectedBuf);
}

function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/**
 * Single email+password form, two outcomes:
 * - The password matches `APP_PASSWORD` → always signs in as the bootstrap
 *   admin account (creating it on first use), *regardless of what email was
 *   typed* — `APP_PASSWORD` is a master key, not tied to any one address.
 *   This is checked first and short-circuits everything else, so it also
 *   works with the email field left blank.
 * - Otherwise → the email must match an invited teammate's account
 *   (`/invite/[token]`), checked against their own `passwordHash`.
 */
export async function POST(request: NextRequest) {
  let body: { password?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const password = body.password ?? "";
  const email = body.email?.trim().toLowerCase();

  const appPassword = process.env.APP_PASSWORD;
  if (appPassword && passwordsMatch(password, appPassword)) {
    const owner = await ensureOwnerUser();
    const token = await createSessionToken(owner.id);
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, token);
    return response;
  }

  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = await createSessionToken(user.id);
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, token);
    return response;
  }

  return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
}
