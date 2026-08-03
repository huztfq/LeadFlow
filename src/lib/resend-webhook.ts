import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Resend signs webhooks using Svix (https://docs.svix.com/receiving/verifying-payloads/how).
 * We verify manually here rather than pulling in the `svix` package, since the
 * scheme is a small, well-documented HMAC check:
 *
 *   signed_content = "{svix-id}.{svix-timestamp}.{raw_body}"
 *   secret_bytes   = base64_decode(secret without the "whsec_" prefix)
 *   signature      = base64(HMAC_SHA256(secret_bytes, signed_content))
 *
 * `svix-signature` carries one or more space-separated "v1,<base64sig>" values
 * (for secret rotation); a match against any of them is a valid signature.
 */
export type SvixHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

const TOLERANCE_SECONDS = 5 * 60;

function computeSignature(secret: string, signedContent: string): string {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return createHmac("sha256", secretBytes).update(signedContent).digest("base64");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verifies a Resend webhook request. Returns true when the signature matches
 * and the timestamp is within tolerance. If `secret` is empty, this always
 * returns false — callers should decide how to handle "no secret configured"
 * (see the webhook route, which allows unsigned requests through in that case
 * with a loud warning, since that's expected in local dev).
 */
export function verifyResendWebhookSignature(
  rawBody: string,
  headers: SvixHeaders,
  secret: string | undefined,
): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;

  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp)) return false;
  const ageSeconds = Math.abs(Date.now() / 1000 - timestamp);
  if (ageSeconds > TOLERANCE_SECONDS) return false;

  const signedContent = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const expected = computeSignature(secret, signedContent);

  const candidates = headers.signature
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.includes(",") ? part.split(",")[1] : part));

  return candidates.some((candidate) => {
    try {
      return safeEqual(candidate, expected);
    } catch {
      return false;
    }
  });
}
