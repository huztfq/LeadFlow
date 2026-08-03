import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { verifyOAuthState } from "@/lib/calendar-google";
import { exchangeGoogleLoginCode, fetchGoogleIdentity } from "@/lib/google-login";
import { prisma } from "@/lib/db";

function redirectToLogin(request: NextRequest, error: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("googleError", error);
  return NextResponse.redirect(url);
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
 * Public: completes "Sign in with Google" — invite-only, by design. Signs in
 * an existing `User` whose email matches the Google account, or auto-accepts
 * a still-pending, unexpired `Invite` for that email (same as accepting via
 * the emailed link, just without setting a password). Anyone else — no
 * account and no pending invite — is bounced back to the login page with
 * `googleError=not_invited` so the UI can point them at the waitlist instead.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("error")) return redirectToLogin(request, "oauth_failed");

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !verifyOAuthState(state)) return redirectToLogin(request, "oauth_failed");

  let email: string;
  let name: string | null;
  try {
    const tokens = await exchangeGoogleLoginCode(code);
    const identity = await fetchGoogleIdentity(tokens.access_token);
    if (!identity) return redirectToLogin(request, "oauth_failed");
    email = identity.email;
    name = identity.name;
  } catch {
    return redirectToLogin(request, "oauth_failed");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const token = await createSessionToken(existing.id);
    const response = NextResponse.redirect(new URL("/assistant", request.url));
    setSessionCookie(response, token);
    return response;
  }

  const invite = await prisma.invite.findFirst({
    where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (invite) {
    const now = new Date();
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: invite.email,
          name,
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

    const token = await createSessionToken(user.id);
    const response = NextResponse.redirect(new URL("/assistant", request.url));
    setSessionCookie(response, token);
    return response;
  }

  return redirectToLogin(request, "not_invited");
}
