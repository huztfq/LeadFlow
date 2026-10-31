import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { speedAuditFrom } from "@/lib/apollo-context";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      title: true,
      company: true,
      industry: true,
      location: true,
      phone: true,
      rawJson: true,
    },
  });
  if (!lead) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const { rawJson, ...rest } = lead;
  return NextResponse.json({ lead: { ...rest, speedAudit: speedAuditFrom(rawJson) } });
}
