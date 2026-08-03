import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { verifyDomain, type ResendDomainError } from "@/lib/resend-domains";

type RouteContext = { params: Promise<{ id: string }> };

function errorStatus(error: unknown): number {
  const statusCode = (error as ResendDomainError | undefined)?.statusCode;
  if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 600) return statusCode;
  return 502;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const domain = await verifyDomain(id);
    return NextResponse.json({ domain });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify domain";
    return NextResponse.json({ error: message }, { status: errorStatus(error) });
  }
}
