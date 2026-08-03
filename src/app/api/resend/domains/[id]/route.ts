import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { getDomain, removeDomain, updateDomain, type ResendDomainError } from "@/lib/resend-domains";

const updateDomainSchema = z.object({
  openTracking: z.boolean().optional(),
  clickTracking: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

function errorStatus(error: unknown): number {
  const statusCode = (error as ResendDomainError | undefined)?.statusCode;
  if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 600) return statusCode;
  return 502;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const domain = await getDomain(id);
    return NextResponse.json({ domain });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load domain";
    return NextResponse.json({ error: message }, { status: errorStatus(error) });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateDomainSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid domain data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.openTracking === undefined && parsed.data.clickTracking === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const domain = await updateDomain(id, parsed.data);
    return NextResponse.json({ domain });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update domain";
    return NextResponse.json({ error: message }, { status: errorStatus(error) });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await removeDomain(id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove domain";
    return NextResponse.json({ error: message }, { status: errorStatus(error) });
  }
}
