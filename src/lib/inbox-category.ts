import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

export const INBOX_CATEGORIES = [
  "interested",
  "not_interested",
  "booked",
  "question",
  "ooo",
  "unsubscribe",
  "other",
] as const;

export type InboxCategoryValue = (typeof INBOX_CATEGORIES)[number];

export type CategorySource = "ai" | "heuristic" | "manual";

export type CategoryResult = {
  category: InboxCategoryValue;
  confidence: number;
  source: CategorySource;
};

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

const categorySchema = z.object({
  category: z.enum(INBOX_CATEGORIES).describe("The single best-fitting category"),
  confidence: z.number().min(0).max(1).describe("How confident you are, 0-1"),
});

const SYSTEM = `You triage replies to cold outbound sales emails for a single operator.
Classify each reply into exactly one category:
- interested: wants to learn more, positive tone, asks for details/next steps
- booked: confirms or requests a specific meeting/call time, or references a booking link/calendar invite
- not_interested: declines, says no thanks, asks not to be contacted (but not a formal unsubscribe request)
- question: asks a clarifying question about the offer/pricing/product without clear interest signal
- ooo: automated out-of-office / auto-reply
- unsubscribe: explicitly asks to be removed from the list / stop emailing
- other: anything else (bounces, spam, unrelated)
Respond with the single best category and a confidence from 0 to 1.`;

/**
 * Deterministic, dependency-free fallback used when ANTHROPIC_API_KEY isn't
 * set (or the AI call fails), so the Inbox is always usable in local/demo
 * environments. Pure function — see inbox-category.test.ts.
 */
export function guessCategoryHeuristic(input: { subject?: string | null; body: string }): InboxCategoryValue {
  const text = `${input.subject ?? ""} ${input.body}`.toLowerCase();

  if (/\bunsubscribe\b|remove me from|stop emailing|opt[- ]?out|take me off/.test(text)) {
    return "unsubscribe";
  }
  if (/out of office|ooo\b|on (leave|vacation|pto)|auto[- ]?reply|automatic reply/.test(text)) {
    return "ooo";
  }
  if (
    /\bbooked\b|book(ed)? (a |the )?(call|meeting|demo|time)|calendly|scheduled (a |the )?call|see you (on|at)|confirmed for/.test(
      text,
    )
  ) {
    return "booked";
  }
  if (/not interested|no thanks|not a fit|please stop|not looking|not the right time/.test(text)) {
    return "not_interested";
  }
  if (
    /interested|sounds good|let'?s talk|tell me more|sign me up|yes please|would love to|keen to/.test(text)
  ) {
    return "interested";
  }
  if (text.includes("?")) return "question";
  return "other";
}

/**
 * Categorizes a reply with Claude (matching the Studio chat model config),
 * falling back to the heuristic above when no API key is set or the call
 * errors, so the Inbox never blocks on the AI provider.
 */
export async function categorizeReply(input: { subject?: string | null; body: string }): Promise<CategoryResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { category: guessCategoryHeuristic(input), confidence: 0.5, source: "heuristic" };
  }

  try {
    const { object } = await generateObject({
      model: anthropic(ANTHROPIC_MODEL),
      schema: categorySchema,
      system: SYSTEM,
      prompt: `Subject: ${input.subject ?? "(no subject)"}\n\nBody:\n${input.body.slice(0, 4000)}`,
    });
    return { category: object.category, confidence: object.confidence, source: "ai" };
  } catch {
    return { category: guessCategoryHeuristic(input), confidence: 0.4, source: "heuristic" };
  }
}

export function categoryLabel(category: InboxCategoryValue): string {
  switch (category) {
    case "not_interested":
      return "Not interested";
    case "ooo":
      return "Out of office";
    default:
      return category.charAt(0).toUpperCase() + category.slice(1);
  }
}
