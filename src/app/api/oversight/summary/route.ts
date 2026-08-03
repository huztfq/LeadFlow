import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { getOversightSummary } from "@/lib/oversight";

/** Owner-only: account-wide counters for the Oversight summary strip. */
export async function GET(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "You don't have access to Oversight" }, { status: 403 });
  }

  const summary = await getOversightSummary();
  return NextResponse.json({ summary });
}
