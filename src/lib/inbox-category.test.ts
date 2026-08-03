import { describe, expect, it } from "vitest";
import { guessCategoryHeuristic } from "./inbox-category";

describe("guessCategoryHeuristic", () => {
  it("detects unsubscribe requests", () => {
    expect(guessCategoryHeuristic({ subject: "Re: intro", body: "Please unsubscribe me from this list." })).toBe(
      "unsubscribe",
    );
    expect(guessCategoryHeuristic({ body: "stop emailing me, remove me from your list" })).toBe("unsubscribe");
  });

  it("detects out-of-office auto-replies", () => {
    expect(guessCategoryHeuristic({ subject: "Automatic reply: Out of office", body: "I'm on leave until Monday." })).toBe(
      "ooo",
    );
  });

  it("detects booked meetings", () => {
    expect(guessCategoryHeuristic({ body: "Sure, let's book a call for Thursday at 2pm." })).toBe("booked");
    expect(guessCategoryHeuristic({ body: "Here's my calendly link, scheduled a call already" })).toBe("booked");
  });

  it("detects not interested", () => {
    expect(guessCategoryHeuristic({ body: "Thanks but we're not interested right now." })).toBe("not_interested");
  });

  it("detects interested", () => {
    expect(guessCategoryHeuristic({ body: "This sounds good, tell me more!" })).toBe("interested");
  });

  it("falls back to question when there's a question mark with no other signal", () => {
    expect(guessCategoryHeuristic({ body: "What's the pricing for this?" })).toBe("question");
  });

  it("falls back to other for unrelated text", () => {
    expect(guessCategoryHeuristic({ body: "Delivery status notification (failure)" })).toBe("other");
  });

  it("prioritizes unsubscribe over other signals", () => {
    expect(
      guessCategoryHeuristic({ body: "This sounds interesting but please unsubscribe me, I'm not interested." }),
    ).toBe("unsubscribe");
  });
});
