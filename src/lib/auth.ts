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

export async function verifySessionToken(token: string): Promise<boolean> {
  return (await decodeSessionToken(token)) !== null;
}

/** True if the request carries a validly-signed session cookie. Doesn't load the user. */
export async function requireSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE)?.value;
  return token ? verifySessionToken(token) : false;
}

/**
 * Loads the signed-in `User` for this request, if any. Returns `null` for a
 * missing/invalid cookie *and* for legacy tokens signed before multi-user
 * support (no `uid` claim) — those callers should fall back to
 * `requireSession` for basic gating, or prompt a re-login to pick up a user.
 */
export async function getCurrentUser(request: NextRequest): Promise<User | null> {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return null;
  const payload = await decodeSessionToken(token);
  if (!payload?.uid) return null;
  return prisma.user.findUnique({ where: { id: payload.uid } });
}

/** Loads the signed-in user and 401s (via thrown marker) unless they're the owner. */
export async function requireOwner(request: NextRequest): Promise<User | null> {
  const user = await getCurrentUser(request);
  if (!user || user.role !== "owner") return null;
  return user;
}

export { COOKIE as SESSION_COOKIE };
