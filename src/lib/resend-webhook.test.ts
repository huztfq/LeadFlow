import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyResendWebhookSignature } from "./resend-webhook";

const SECRET = `whsec_${Buffer.from("test-signing-secret-bytes").toString("base64")}`;

function sign(id: string, timestamp: string, body: string): string {
  const secretBytes = Buffer.from(SECRET.replace(/^whsec_/, ""), "base64");
  const signature = createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${body}`).digest("base64");
  return `v1,${signature}`;
}

describe("verifyResendWebhookSignature", () => {
  it("accepts a correctly signed payload", () => {
    const body = JSON.stringify({ type: "email.opened", data: { email_id: "abc" } });
    const id = "msg_123";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(id, timestamp, body);

    expect(verifyResendWebhookSignature(body, { id, timestamp, signature }, SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const id = "msg_123";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(id, timestamp, JSON.stringify({ type: "email.opened" }));

    expect(
      verifyResendWebhookSignature(JSON.stringify({ type: "email.bounced" }), { id, timestamp, signature }, SECRET),
    ).toBe(false);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const body = JSON.stringify({ type: "email.opened" });
    const id = "msg_123";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const wrongSecretBytes = Buffer.from("wrong-secret-bytes-here").toString("base64");
    const signature = `v1,${createHmac("sha256", Buffer.from(wrongSecretBytes, "base64"))
      .update(`${id}.${timestamp}.${body}`)
      .digest("base64")}`;

    expect(verifyResendWebhookSignature(body, { id, timestamp, signature }, SECRET)).toBe(false);
  });

  it("rejects a stale timestamp", () => {
    const body = JSON.stringify({ type: "email.opened" });
    const id = "msg_123";
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 60 * 60);
    const signature = sign(id, staleTimestamp, body);

    expect(verifyResendWebhookSignature(body, { id, timestamp: staleTimestamp, signature }, SECRET)).toBe(false);
  });

  it("rejects when headers are missing", () => {
    expect(verifyResendWebhookSignature("{}", { id: null, timestamp: null, signature: null }, SECRET)).toBe(false);
  });

  it("rejects when no secret is configured", () => {
    const body = "{}";
    const id = "msg_123";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(id, timestamp, body);

    expect(verifyResendWebhookSignature(body, { id, timestamp, signature }, undefined)).toBe(false);
  });

  it("accepts when the matching signature is one of several space-separated values", () => {
    const body = JSON.stringify({ type: "email.clicked" });
    const id = "msg_456";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const correct = sign(id, timestamp, body);
    const signature = `v1,not-a-real-signature ${correct}`;

    expect(verifyResendWebhookSignature(body, { id, timestamp, signature }, SECRET)).toBe(true);
  });
});
