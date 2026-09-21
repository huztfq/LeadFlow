import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { appendCampaignChrome } from "@/lib/campaign-email";
import { ensureOpenerSlot, renderTemplate, stripEmptyOpenerParagraphs } from "@/lib/merge-fields";
import { generatePersonalizedOpener } from "@/lib/personalize";
import { isInSendWindow, nextSendWindowStart, sendWindowFromEnv } from "@/lib/send-window";
import { advanceEnrollment } from "@/lib/sequence";
import { sendCampaignEmail, type SendCampaignEmailError } from "@/lib/resend";
import { signUnsubscribeToken } from "@/lib/unsubscribe";
import { CampaignStatus, EnrollmentStatus } from "@/generated/prisma/enums";

export const maxDuration = 120;

// Rows claimed per database round-trip. Small so a killed invocation leaves
// few rows leased; the outer loop keeps claiming until a cap or the time
// budget is hit.
const CLAIM_SIZE = 10;
// Stop claiming new rows after this long so the last batch (Claude + Resend
// per row) still finishes inside maxDuration.
const TIME_BUDGET_MS = 90 * 1000;
// Upper bound on sends per invocation; CRON_MAX_PER_RUN overrides.
const DEFAULT_MAX_PER_RUN = 40;
// Upper bound on sends per UTC day across all campaigns — including sends
// logged by import scripts — so a backlog of overdue follow-ups drains at a
// steady rate instead of as one spike. CRON_DAILY_CAP overrides.
const DEFAULT_DAILY_CAP = 150;
// While a batch is "leased" its nextSendAt is pushed into the future so a
// concurrent or retried invocation (or a run that gets killed mid-batch)
// won't immediately re-claim and re-send the same rows.
const LEASE_MS = 15 * 60 * 1000;
// Deferred rows are spread across the window opening so one cron tick doesn't
// release them all in the same minute.
const DEFER_STAGGER_MS = 45 * 1000;

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

function unsubscribeUrl(enrollmentId: string): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("APP_URL is not set");
  return `${appUrl}/api/unsubscribe/${signUnsubscribeToken(enrollmentId)}`;
}

function looksLikeBounce(err: SendCampaignEmailError): boolean {
  if (err.code !== "invalid_parameter" && err.code !== "validation_error") return false;
  return /\bto\b|\bemail\b/i.test(err.message);
}

function positiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function claimDueEnrollments(now: Date, take: number) {
  // Claim due enrollments before doing any sending: select the candidate ids,
  // then immediately lease them by pushing nextSendAt forward inside the same
  // transaction. This closes the at-least-once window where a killed
  // function or an overlapping invocation would otherwise re-pick and
  // re-send the same rows before advanceEnrollment gets a chance to run.
  return prisma.$transaction(async (tx) => {
    const candidates = await tx.enrollment.findMany({
      where: {
        status: EnrollmentStatus.active,
        nextSendAt: { lte: now },
        campaign: { status: CampaignStatus.active },
      },
      take,
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
}

export async function handleCronSend(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const now = new Date();
  const maxPerRun = positiveIntEnv("CRON_MAX_PER_RUN", DEFAULT_MAX_PER_RUN);
  const dailyCap = positiveIntEnv("CRON_DAILY_CAP", DEFAULT_DAILY_CAP);
  const window = sendWindowFromEnv(process.env.CRON_SEND_WINDOW);

  const sentToday = await prisma.sendLog.count({
    where: { status: "sent", sentAt: { gte: startOfUtcDay(now) } },
  });
  let remainingToday = Math.max(0, dailyCap - sentToday);

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let deferred = 0;
  let deferIndex = 0;

  while (
    remainingToday > 0 &&
    sent < maxPerRun &&
    Date.now() - startedAt < TIME_BUDGET_MS
  ) {
    const take = Math.min(CLAIM_SIZE, maxPerRun - sent, remainingToday);
    const dueEnrollments = await claimDueEnrollments(new Date(), take);
    if (dueEnrollments.length === 0) break;

    for (const enrollment of dueEnrollments) {
      const { campaign, lead } = enrollment;
      const step = campaign.steps.find((s) => s.stepOrder === enrollment.currentStep);

      if (!step || !lead.email) {
        await prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { status: EnrollmentStatus.failed },
        });
        processed += 1;
        failed += 1;
        continue;
      }

      // Outside the recipient's local window: park the row at the next
      // opening instead of sending. Not counted against the caps.
      if (window && !isInSendWindow(now, lead.location, window)) {
        const opensAt = nextSendWindowStart(now, lead.location, window);
        await prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { nextSendAt: new Date(opensAt.getTime() + deferIndex * DEFER_STAGGER_MS) },
        });
        deferIndex += 1;
        deferred += 1;
        continue;
      }

      processed += 1;

      const opener = await generatePersonalizedOpener({
        lead,
        campaignName: campaign.name,
        emailSubject: step.subject,
        emailBodyHtml: step.bodyHtml,
      });
      const fields = {
        firstName: lead.firstName,
        lastName: lead.lastName,
        company: lead.company,
        title: lead.title,
        industry: lead.industry,
        location: lead.location,
        opener,
      };
      const bodyTemplate = opener ? ensureOpenerSlot(step.bodyHtml) : step.bodyHtml;
      const subject = renderTemplate(step.subject, fields);
      const unsubscribe = unsubscribeUrl(enrollment.id);
      const html = appendCampaignChrome(
        stripEmptyOpenerParagraphs(renderTemplate(bodyTemplate, fields)),
        unsubscribe,
      );

      try {
        const { id: resendId } = await sendCampaignEmail({
          to: lead.email,
          subject,
          html,
          unsubscribeUrl: unsubscribe,
        });

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
        remainingToday -= 1;
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
  }

  return NextResponse.json({ processed, sent, failed, deferred, sentToday: sentToday + sent, dailyCap });
}

export async function GET(request: NextRequest) {
  return handleCronSend(request);
}

export async function POST(request: NextRequest) {
  return handleCronSend(request);
}
