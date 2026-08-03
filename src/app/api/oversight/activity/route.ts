import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { getRecentActivity } from "@/lib/oversight";

/** Owner-only: reverse-chronological activity feed synthesized from existing tables. */
export async function GET(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "You don't have access to Oversight" }, { status: 403 });
  }

  const events = await getRecentActivity(40);
  return NextResponse.json({ events });
}
