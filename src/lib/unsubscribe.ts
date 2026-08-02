import { createHmac, timingSafeEqual } from "node:crypto";

function hmacSecret(): string {
  // UNSUBSCRIBE_SECRET is a distinct key from APP_PASSWORD so a mailed
  // unsubscribe link (a public message/signature pair) can't be used as an
  // offline brute-force oracle against the login password. Falling back to
  // APP_PASSWORD keeps local dev working without extra setup, but production
  // should always set UNSUBSCRIBE_SECRET explicitly.
  const secret = process.env.UNSUBSCRIBE_SECRET ?? process.env.APP_PASSWORD;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET (or APP_PASSWORD) is not set");
  return secret;
}

function signEnrollmentId(enrollmentId: string): string {
  return createHmac("sha256", hmacSecret()).update(enrollmentId).digest("hex");
}

export function signUnsubscribeToken(enrollmentId: string): string {
  return `${enrollmentId}.${signEnrollmentId(enrollmentId)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const enrollmentId = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!signature) return null;

  const expected = signEnrollmentId(enrollmentId);

  try {
    const actualBuf = Buffer.from(signature, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (actualBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(actualBuf, expectedBuf)) return null;
    return enrollmentId;
  } catch {
    return null;
  }
}
