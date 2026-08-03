import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { outreachPlanSchema } from "@/lib/assistant-plan";
import { executeOutreachPlan } from "@/lib/assistant-execute";
import {
  assertAiCreditsAvailable,
  assertApolloCreditsAvailable,
  consumeAiCredits,
  consumeApolloCredits,
  CreditLimitExceededError,
} from "@/lib/team";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertAiCreditsAvailable(user);
    assertApolloCreditsAvailable(user);
  } catch (error) {
    if (error instanceof CreditLimitExceededError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = outreachPlanSchema.safeParse(
    body && typeof body === "object" && "plan" in body
      ? (body as { plan: unknown }).plan
      : body,
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid plan", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await executeOutreachPlan(parsed.data);
    await Promise.all([
      consumeAiCredits(user, 1),
      consumeApolloCredits(user.id, result.enriched),
    ]);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Execution failed";
    console.error("assistant execute failed:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
