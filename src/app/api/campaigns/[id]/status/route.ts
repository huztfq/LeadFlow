import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CampaignStatus } from "@/generated/prisma/enums";

const statusSchema = z.object({
  status: z.enum([CampaignStatus.active, CampaignStatus.paused, CampaignStatus.completed]),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
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

  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid status data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (existing.status === CampaignStatus.completed) {
    return NextResponse.json(
      { error: "Completed campaigns cannot change status" },
      { status: 409 },
    );
  }

  // Pause/resume (and marking complete) only ever touch the campaign's status —
  // enrollment progress (currentStep/nextSendAt) is left untouched.
  const campaign = await prisma.campaign.update({
    where: { id },
    data: { status: parsed.data.status },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  return NextResponse.json({ campaign });
}
