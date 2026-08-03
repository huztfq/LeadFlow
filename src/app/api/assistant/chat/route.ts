import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText, tool, type UIMessage } from "ai";
import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { outreachPlanSchema } from "@/lib/assistant-plan";
import { assertAiCreditsAvailable, consumeAiCredits, CreditLimitExceededError } from "@/lib/team";

export const maxDuration = 60;

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

const SYSTEM = `You are Leadflow Studio, an expert B2B outbound strategist inside a lead + email campaign product.

Your job:
1) Ask short, focused questions (usually 1–2 at a time) to learn:
   - who they want to reach (titles, industry, company type)
   - where (locations / markets)
   - roughly how many leads (max 25 per run)
   - offer / value prop and tone
   - sequence length (1–3 emails recommended)
2) When you have enough to act, call the present_plan tool with a concrete Apollo search + multi-step email campaign.
3) Do NOT claim you already imported or sent anything. After present_plan, tell the user to click **Approve & start** in the UI.
4) Email bodies must be HTML snippets (use <p> tags). Include merge fields {{firstName}}, {{company}}, {{title}} where natural.
5) Keep copy crisp and operator-friendly. No fluff.
6) Prefer people with email available. targetCount ≤ 25.`;

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
