import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { getOversightWaitlist } from "@/lib/oversight";

/** Owner-only: every waitlist signup for the Oversight Waitlist section. */
export async function GET(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "You don't have access to Oversight" }, { status: 403 });
  }

  const waitlist = await getOversightWaitlist();
  return NextResponse.json({ waitlist });
}
