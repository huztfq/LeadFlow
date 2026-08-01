import { beforeEach, describe, expect, it } from "vitest";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe";

describe("unsubscribe tokens", () => {
  beforeEach(() => {
    process.env.APP_PASSWORD = "test-secret";
  });

  it("round-trips sign and verify", () => {
    const enrollmentId = "clxyz123enrollment";
    const token = signUnsubscribeToken(enrollmentId);
    expect(verifyUnsubscribeToken(token)).toBe(enrollmentId);
  });

  it("rejects tampered signature", () => {
    const token = signUnsubscribeToken("clxyz123enrollment");
    const [id, sig] = token.split(".");
    expect(verifyUnsubscribeToken(`${id}.${sig.slice(0, -1)}0`)).toBeNull();
  });

  it("rejects tampered enrollment id", () => {
    const token = signUnsubscribeToken("clxyz123enrollment");
    const [, sig] = token.split(".");
    expect(verifyUnsubscribeToken(`other-id.${sig}`)).toBeNull();
  });

  it("rejects malformed token", () => {
    expect(verifyUnsubscribeToken("not-a-valid-token")).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
  });
});
