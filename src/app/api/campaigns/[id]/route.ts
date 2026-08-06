import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stepInputSchema } from "@/app/api/campaigns/route";
import { CampaignStatus } from "@/generated/prisma/enums";
import { backfillDraftCampaignsWithActivity } from "@/lib/campaign-status";

const patchCampaignSchema = z.object({
  name: z.string().trim().min(1, "name is required").optional(),
  steps: z.array(stepInputSchema).min(1, "at least one step is required").optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Send-activity/enrollment data plus the (possibly self-healed) status for a
 * campaign. Shared by GET and PATCH so every endpoint that returns a
 * campaign to the client returns the same complete shape — the detail page
 * renders stats/sendLogs/enrollments unconditionally, so a response missing
 * any of these crashes the page.
 */
async function loadCampaignActivity(id: string, currentStatus: CampaignStatus) {
  const [promotedIds, rawSendLogs, rawEnrollments, totalSent, totalOpened, totalClicked, totalReplied, totalBounced] =
    await Promise.all([
      backfillDraftCampaignsWithActivity([id]),
      prisma.sendLog.findMany({
        where: { enrollment: { campaignId: id } },
        orderBy: { sentAt: "desc" },
        take: 20,
        include: { step: { select: { stepOrder: true, subject: true } }, enrollment: { include: { lead: true } } },
      }),
      prisma.enrollment.findMany({
        where: { campaignId: id },
        orderBy: { updatedAt: "desc" },
        include: {
          lead: { select: { email: true, firstName: true, lastName: true } },
          sendLogs: {
            orderBy: { sentAt: "desc" },
            take: 1,
            select: { status: true, error: true, sentAt: true, openedAt: true, repliedAt: true },
          },
        },
      }),
      prisma.sendLog.count({ where: { enrollment: { campaignId: id }, status: "sent" } }),
      prisma.sendLog.count({ where: { enrollment: { campaignId: id }, openedAt: { not: null } } }),
      prisma.sendLog.count({ where: { enrollment: { campaignId: id }, clickedAt: { not: null } } }),
      prisma.sendLog.count({ where: { enrollment: { campaignId: id }, repliedAt: { not: null } } }),
      prisma.sendLog.count({ where: { enrollment: { campaignId: id }, bouncedAt: { not: null } } }),
    ]);

  const sendLogs = rawSendLogs.map((log) => ({
    id: log.id,
    status: log.status,
    error: log.error,
    sentAt: log.sentAt,
    stepOrder: log.step.stepOrder,
    subject: log.step.subject,
    leadEmail: log.enrollment.lead.email,
    openedAt: log.openedAt,
    clickedAt: log.clickedAt,
    repliedAt: log.repliedAt,
    bouncedAt: log.bouncedAt,
  }));

  const enrollments = rawEnrollments.map((enrollment) => {
    const lastLog = enrollment.sendLogs[0];
    return {
      id: enrollment.id,
      leadId: enrollment.leadId,
      leadEmail: enrollment.lead.email,
      leadName: [enrollment.lead.firstName, enrollment.lead.lastName].filter(Boolean).join(" ") || null,
      status: enrollment.status,
      currentStep: enrollment.currentStep,
      attemptCount: enrollment.attemptCount,
      nextSendAt: enrollment.nextSendAt,
      lastError: lastLog?.status === "failed" ? lastLog.error : null,
      lastSentAt: lastLog?.sentAt ?? null,
      lastOpenedAt: lastLog?.openedAt ?? null,
      lastRepliedAt: lastLog?.repliedAt ?? null,
    };
  });

  const status = promotedIds.includes(id) ? CampaignStatus.active : currentStatus;
  const stats = { totalSent, totalOpened, totalClicked, totalReplied, totalBounced };

  return { status, sendLogs, enrollments, stats };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const activity = await loadCampaignActivity(id, campaign.status);

  return NextResponse.json({ campaign: { ...campaign, ...activity } });
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

  const parsed = patchCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid campaign data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, steps } = parsed.data;
  if (name === undefined && steps === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (steps !== undefined && existing.status !== CampaignStatus.draft) {
    return NextResponse.json(
      { error: "Steps can only be edited while the campaign is in draft status" },
      { status: 409 },
    );
  }

  const campaign = await prisma.$transaction(async (tx) => {
    if (steps !== undefined) {
      await tx.sequenceStep.deleteMany({ where: { campaignId: id } });
    }

    return tx.campaign.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(steps !== undefined
          ? {
              steps: {
                create: steps.map((step, index) => ({
                  stepOrder: index,
                  delayDays: step.delayDays,
                  subject: step.subject,
                  bodyHtml: step.bodyHtml,
                })),
              },
            }
          : {}),
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
  });

  const activity = await loadCampaignActivity(id, campaign.status);

  return NextResponse.json({ campaign: { ...campaign, ...activity } });
}
