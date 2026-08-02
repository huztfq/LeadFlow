import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { renderTemplate } from "@/lib/merge-fields";
import { advanceEnrollment } from "@/lib/sequence";
import { sendCampaignEmail, type SendCampaignEmailError } from "@/lib/resend";
import { signUnsubscribeToken } from "@/lib/unsubscribe";
import { CampaignStatus, EnrollmentStatus } from "@/generated/prisma/enums";

export const maxDuration = 60;

// Small enough that BATCH_SIZE sequential Resend calls comfortably finish
// within maxDuration.
const BATCH_SIZE = 10;
// While a batch is "leased" its nextSendAt is pushed into the future so a
// concurrent or retried invocation (or a run that gets killed mid-batch)
// won't immediately re-claim and re-send the same rows.
const LEASE_MS = 15 * 60 * 1000;

type AdvancedFields = {
  currentStep: number;
  attemptCount: number;
  status: EnrollmentStatus;
  nextSendAt: Date | null;
};

function enrollmentUpdateData(advanced: AdvancedFields) {
  return {
    currentStep: advanced.currentStep,
    attemptCount: advanced.attemptCount,
    status: advanced.status,
    // nextSendAt is non-nullable in the DB; once a row leaves "active" status
    // it's no longer picked up by the due-enrollments query, so we simply
    // leave the last known nextSendAt in place instead of clearing it.
    ...(advanced.nextSendAt ? { nextSendAt: advanced.nextSendAt } : {}),
  };
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

function buildUnsubscribeFooter(enrollmentId: string): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("APP_URL is not set");
  const token = signUnsubscribeToken(enrollmentId);
  const url = `${appUrl}/api/unsubscribe/${token}`;
  return `<p style="margin-top:24px;font-size:12px;color:#71717a;">Don't want these emails? <a href="${url}">Unsubscribe</a>.</p>`;
}

function looksLikeBounce(err: SendCampaignEmailError): boolean {
  if (err.code !== "invalid_parameter" && err.code !== "validation_error") return false;
  return /\bto\b|\bemail\b/i.test(err.message);
}

export async function handleCronSend(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Claim due enrollments before doing any sending: select the candidate ids,
  // then immediately lease them by pushing nextSendAt forward inside the same
  // transaction. This closes the at-least-once window where a killed
  // function or an overlapping invocation would otherwise re-pick and
  // re-send the same rows before advanceEnrollment gets a chance to run.
  const dueEnrollments = await prisma.$transaction(async (tx) => {
    const candidates = await tx.enrollment.findMany({
      where: {
        status: EnrollmentStatus.active,
        nextSendAt: { lte: now },
        campaign: { status: CampaignStatus.active },
      },
      take: BATCH_SIZE,
      orderBy: { nextSendAt: "asc" },
      select: { id: true },
    });

    if (candidates.length === 0) return [];

    const ids = candidates.map((c) => c.id);
    await tx.enrollment.updateMany({
      where: { id: { in: ids }, status: EnrollmentStatus.active, nextSendAt: { lte: now } },
      data: { nextSendAt: new Date(now.getTime() + LEASE_MS) },
    });

    return tx.enrollment.findMany({
      where: { id: { in: ids } },
      include: {
        campaign: { include: { steps: { orderBy: { stepOrder: "asc" } } } },
        lead: true,
      },
    });
  });

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const enrollment of dueEnrollments) {
    processed += 1;
    const { campaign, lead } = enrollment;
    const step = campaign.steps.find((s) => s.stepOrder === enrollment.currentStep);

    if (!step || !lead.email) {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: EnrollmentStatus.failed },
      });
      failed += 1;
      continue;
    }

    const subject = renderTemplate(step.subject, lead);
    const html = renderTemplate(step.bodyHtml, lead) + buildUnsubscribeFooter(enrollment.id);

    try {
      const { id: resendId } = await sendCampaignEmail({ to: lead.email, subject, html });

      const advanced = advanceEnrollment({
        currentStep: enrollment.currentStep,
        attemptCount: enrollment.attemptCount,
        steps: campaign.steps,
        now,
        sendSucceeded: true,
        isTransientError: false,
      });

      await prisma.$transaction([
        prisma.sendLog.create({
          data: { enrollmentId: enrollment.id, stepId: step.id, resendId, status: "sent" },
        }),
        prisma.enrollment.update({
          where: { id: enrollment.id },
          data: enrollmentUpdateData(advanced),
        }),
      ]);
      sent += 1;
    } catch (error) {
      const err = error as SendCampaignEmailError;
      const transient = err.transient ?? false;

      const advanced = advanceEnrollment({
        currentStep: enrollment.currentStep,
        attemptCount: enrollment.attemptCount,
        steps: campaign.steps,
        now,
        sendSucceeded: false,
        isTransientError: transient,
      });

      const enrollmentStatus: EnrollmentStatus =
        advanced.status === "failed" && looksLikeBounce(err)
          ? EnrollmentStatus.bounced
          : (advanced.status as EnrollmentStatus);

      await prisma.$transaction([
        prisma.sendLog.create({
          data: {
            enrollmentId: enrollment.id,
            stepId: step.id,
            status: "failed",
            error: err.message,
          },
        }),
        prisma.enrollment.update({
          where: { id: enrollment.id },
          data: enrollmentUpdateData({ ...advanced, status: enrollmentStatus }),
        }),
      ]);
      failed += 1;
    }
  }

  return NextResponse.json({ processed, sent, failed });
}

export async function GET(request: NextRequest) {
  return handleCronSend(request);
}

export async function POST(request: NextRequest) {
  return handleCronSend(request);
}
