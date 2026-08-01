import { createHmac, timingSafeEqual } from "node:crypto";

function hmacSecret(): string {
  const password = process.env.APP_PASSWORD;
  if (!password) throw new Error("APP_PASSWORD is not set");
  return password;
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
