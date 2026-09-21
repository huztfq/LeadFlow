import { readFileSync } from "node:fs";
import { join } from "node:path";
import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText, tool, type UIMessage } from "ai";
import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { outreachPlanSchema } from "@/lib/assistant-plan";
import { assertAiCreditsAvailable, consumeAiCredits, CreditLimitExceededError } from "@/lib/team";

export const maxDuration = 60;

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

function loadOperatorProfile(): string {
  try {
    return readFileSync(join(process.cwd(), "docs/operator-profile.md"), "utf8");
  } catch {
    return "";
  }
}

const SYSTEM = `You are Leadflow Studio, an expert B2B outbound strategist inside a lead + email campaign product.

Write as Huzaifa Tofeeq / Inferaform using the operator profile below. Do not invent employers, metrics, products, or calendar links.

Your job:
1) Default ICP (unless the operator overrides): small/mid-size businesses (about 5–200 people). Titles: Founder, Owner, CEO, Managing Director, COO, Head of Operations, GM, Marketing Director. Offer: operations pipelines with AI (n8n, CRM, intake/follow-up) plus creative ops (content calendars, brand refresh / brand ID). Goal: book a call.
2) Ask short questions only when something material is missing. When you have enough, call present_plan.
3) Do NOT claim you already imported or sent anything. After present_plan, tell the user to click **Approve & start** in the UI.
4) Email bodies must be HTML snippets (use <p> tags). Include {{firstName}}, {{company}}, {{title}}, and {{opener}}. {{opener}} is filled at send time from Apollo — write the rest after it. Do not invent per-lead facts. Do not add a calendar or booking link — every send already appends https://calendar.app.google/3nUST4xsqchDzfdUA and an Inferaform footer.
5) Voice: first person, short, specific proof from the profile, one ask. Sign Huzaifa. Sequence default: now / +3 days / +7 days after that. targetCount ≤ 30 (Resend free tier: 30 new people/day on a 3-step sequence).
6) Prefer people with email available. Never search for fashion models or "model owner" bank titles.

---
${loadOperatorProfile()}`;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    assertAiCreditsAvailable(user);
  } catch (error) {
    if (error instanceof CreditLimitExceededError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 403 });
    }
    throw error;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { messages?: UIMessage[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const messages = body.messages ?? [];

  // Approximate usage: +1 AI credit per chat request (v1 — see assistant-execute
  // for the credit check gating Apollo-costed plan approval separately).
  await consumeAiCredits(user, 1);

  const result = streamText({
    model: anthropic(ANTHROPIC_MODEL),
    system: SYSTEM,
    messages: await convertToModelMessages(messages),
    tools: {
      present_plan: tool({
        description:
          "Present the final outreach plan for operator approval. Call once you have enough detail.",
        inputSchema: outreachPlanSchema,
        execute: async (plan) => ({
          status: "awaiting_approval" as const,
          plan,
        }),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
