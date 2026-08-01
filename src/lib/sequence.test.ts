import { describe, expect, it } from "vitest";
import { advanceEnrollment, computeNextSendAt } from "./sequence";

describe("computeNextSendAt", () => {
  it("adds whole days", () => {
    const from = new Date("2026-08-02T12:00:00.000Z");
    expect(computeNextSendAt(from, 3).toISOString()).toBe(
      "2026-08-05T12:00:00.000Z",
    );
  });
});

describe("advanceEnrollment", () => {
  const steps = [
    { stepOrder: 0, delayDays: 0 },
    { stepOrder: 1, delayDays: 3 },
  ];
  const now = new Date("2026-08-02T12:00:00.000Z");

  it("moves to next step on success", () => {
    const result = advanceEnrollment({
      currentStep: 0,
      attemptCount: 0,
      steps,
      now,
      sendSucceeded: true,
      isTransientError: false,
    });
    expect(result.status).toBe("active");
    expect(result.currentStep).toBe(1);
    expect(result.attemptCount).toBe(0);
    expect(result.nextSendAt?.toISOString()).toBe("2026-08-05T12:00:00.000Z");
  });

  it("completes after last step", () => {
    const result = advanceEnrollment({
      currentStep: 1,
      attemptCount: 0,
      steps,
      now,
      sendSucceeded: true,
      isTransientError: false,
    });
    expect(result.status).toBe("completed");
    expect(result.nextSendAt).toBeNull();
  });

  it("retries once on transient failure then fails", () => {
    const retry = advanceEnrollment({
      currentStep: 0,
      attemptCount: 0,
      steps,
      now,
      sendSucceeded: false,
      isTransientError: true,
    });
    expect(retry.status).toBe("active");
    expect(retry.attemptCount).toBe(1);

    const failed = advanceEnrollment({
      currentStep: 0,
      attemptCount: 1,
      steps,
      now,
      sendSucceeded: false,
      isTransientError: true,
    });
    expect(failed.status).toBe("failed");
  });
});
