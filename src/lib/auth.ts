import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import type { User } from "@/generated/prisma/client";

const COOKIE = "leadflow_session";
const encoder = new TextEncoder();

type SessionPayload = {
  role: "operator";
  /** User id — absent on legacy pre-multi-user tokens still in a browser's cookie jar. */
  uid?: string;
};

function secretKey() {
  const password = process.env.APP_PASSWORD;
  if (!password) throw new Error("APP_PASSWORD is not set");
  return encoder.encode(password);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ role: "operator", uid: userId } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

async function decodeSessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Loads the signed-in `User` for this request, if any. Returns `null` for a
 * missing/invalid cookie, for legacy tokens signed before multi-user support
 * (no `uid` claim), and — critically — for a cookie whose `uid` no longer
 * has a matching `User` row (e.g. someone was removed from the team, or the
 * DB was reseeded). A validly-signed JWT only proves the cookie hasn't been
 * tampered with; it says nothing about whether the account still exists, so
 * every caller that gates access must go through this DB check rather than
 * trusting the signature alone.
 */
export async function getCurrentUser(request: NextRequest): Promise<User | null> {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return null;
  const payload = await decodeSessionToken(token);
  if (!payload?.uid) return null;
  return prisma.user.findUnique({ where: { id: payload.uid } });
}

/** True if the request carries a session cookie for a User that still exists in the DB. */
export async function requireSession(request: NextRequest): Promise<boolean> {
  return (await getCurrentUser(request)) !== null;
}

/** Loads the signed-in user and 401s (via thrown marker) unless they're the owner. */
export async function requireOwner(request: NextRequest): Promise<User | null> {
  const user = await getCurrentUser(request);
  if (!user || user.role !== "owner") return null;
  return user;
}

export { COOKIE as SESSION_COOKIE };
