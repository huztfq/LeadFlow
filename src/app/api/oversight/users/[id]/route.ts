import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { getOversightUserDetail } from "@/lib/oversight";

type RouteContext = { params: Promise<{ id: string }> };

/** Owner-only: one account's profile, credit usage, chat sessions, and sent invites in detail. */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "You don't have access to Oversight" }, { status: 403 });
  }

  const { id } = await params;
  const detail = await getOversightUserDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
