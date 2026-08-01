import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CampaignStatus, EnrollmentStatus } from "@/generated/prisma/enums";

const enrollSchema = z.object({
  leadIds: z.array(z.string().trim().min(1)).min(1, "leadIds is required"),
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

  const parsed = enrollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid enroll data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (campaign.status === CampaignStatus.completed) {
    return NextResponse.json(
      { error: "Cannot enroll leads into a completed campaign" },
      { status: 409 },
    );
  }

  const uniqueLeadIds = Array.from(new Set(parsed.data.leadIds));

  const [leads, existingEnrollments] = await Promise.all([
    prisma.lead.findMany({
      where: { id: { in: uniqueLeadIds } },
      select: { id: true, email: true },
    }),
    prisma.enrollment.findMany({
      where: { campaignId: id, leadId: { in: uniqueLeadIds } },
      select: { leadId: true },
    }),
  ]);

  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const alreadyEnrolledIds = new Set(existingEnrollments.map((enrollment) => enrollment.leadId));

  let skippedAlreadyEnrolled = 0;
  let skippedNoEmail = 0;
  const leadIdsToEnroll: string[] = [];

  for (const leadId of uniqueLeadIds) {
    if (alreadyEnrolledIds.has(leadId)) {
      skippedAlreadyEnrolled += 1;
      continue;
    }
    const lead = leadById.get(leadId);
    if (!lead || !lead.email) {
      skippedNoEmail += 1;
      continue;
    }
    leadIdsToEnroll.push(leadId);
  }

  let enrolled = 0;
  if (leadIdsToEnroll.length > 0) {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.enrollment.createMany({
        data: leadIdsToEnroll.map((leadId) => ({
          campaignId: id,
          leadId,
          currentStep: 0,
          status: EnrollmentStatus.active,
          nextSendAt: now,
          attemptCount: 0,
        })),
      });

      if (campaign.status === CampaignStatus.draft) {
        await tx.campaign.update({ where: { id }, data: { status: CampaignStatus.active } });
      }
    });
    enrolled = leadIdsToEnroll.length;
  }

  return NextResponse.json({ enrolled, skippedAlreadyEnrolled, skippedNoEmail });
}
