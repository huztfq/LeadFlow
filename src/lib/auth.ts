import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

const COOKIE = "leadflow_session";
const encoder = new TextEncoder();

function secretKey() {
  const password = process.env.APP_PASSWORD;
  if (!password) throw new Error("APP_PASSWORD is not set");
  return encoder.encode(password);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "operator" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secretKey());
    return true;
  } catch {
    return false;
  }
}

export async function requireSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE)?.value;
  return token ? verifySessionToken(token) : false;
}

export { COOKIE as SESSION_COOKIE };
