import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { getOversightUsers } from "@/lib/oversight";

/** Owner-only: every account plus computed activity signals for the Oversight users table. */
export async function GET(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "You don't have access to Oversight" }, { status: 403 });
  }

  const users = await getOversightUsers();
  return NextResponse.json({ users });
}
