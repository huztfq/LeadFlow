type Step = { stepOrder: number; delayDays: number };

type AdvanceEnrollmentArgs = {
  currentStep: number;
  attemptCount: number;
  steps: Step[];
  now: Date;
  sendSucceeded: boolean;
  isTransientError: boolean;
};

type AdvanceEnrollmentResult = {
  currentStep: number;
  attemptCount: number;
  status: "active" | "completed" | "failed";
  nextSendAt: Date | null;
};

export function computeNextSendAt(from: Date, delayDays: number): Date {
  return new Date(from.getTime() + delayDays * 86400000);
}

export function advanceEnrollment(
  args: AdvanceEnrollmentArgs,
): AdvanceEnrollmentResult {
  const {
    currentStep,
    attemptCount,
    steps,
    now,
    sendSucceeded,
    isTransientError,
  } = args;

  if (!sendSucceeded) {
    if (isTransientError && attemptCount === 0) {
      return {
        currentStep,
        attemptCount: 1,
        status: "active",
        nextSendAt: now,
      };
    }
    return {
      currentStep,
      attemptCount,
      status: "failed",
      nextSendAt: null,
    };
  }

  const nextStep = currentStep + 1;
  const nextStepConfig = steps.find((s) => s.stepOrder === nextStep);

  if (!nextStepConfig) {
    return {
      currentStep,
      attemptCount: 0,
      status: "completed",
      nextSendAt: null,
    };
  }

  return {
    currentStep: nextStep,
    attemptCount: 0,
    status: "active",
    nextSendAt: computeNextSendAt(now, nextStepConfig.delayDays),
  };
}
