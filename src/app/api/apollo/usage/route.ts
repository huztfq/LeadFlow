import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getApolloUsage } from "@/lib/apollo";

/**
 * Remaining Apollo credit usage for the API key's account. Uses Apollo's
 * "Get Current User Profile" endpoint with `include_credit_usage=true`
 * (0 credits) — the only credit balance data exposed to non-master API keys.
 */
export async function GET(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const usage = await getApolloUsage();
    return NextResponse.json(usage);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Apollo usage lookup failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
