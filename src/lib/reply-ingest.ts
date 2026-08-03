import { prisma } from "@/lib/db";
import { categorizeReply } from "@/lib/inbox-category";
import type { InboxCategoryValue } from "@/lib/inbox-category";
import { EnrollmentStatus } from "@/generated/prisma/enums";

export type IngestReplyInput = {
  fromEmail: string;
  toEmail?: string | null;
  subject?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  resendEmailId?: string | null;
  rawJson?: unknown;
  /** Skip the AI/heuristic call and force a category (used by manual seeds/tests). */
  forceCategory?: InboxCategoryValue;
};

/**
 * Shared path for turning a normalized inbound email into an `InboxMessage`:
 * matches it to a lead (by email) and, through the lead, the most relevant
 * enrollment/campaign, then runs AI categorization.
 *
 * Resend doesn't currently offer inbound-email webhooks, so in this app the
 * only caller today is `/api/inbox/simulate-reply` (a session-gated dev/demo
 * button). If you wire up a real inbound source later — a receiving domain,
 * or a third-party inbound-parse webhook (Postmark, SendGrid, a Cloudflare
 * Email Worker, etc.) — normalize its payload into `IngestReplyInput` and
 * call this same function so categorization/stats behave identically.
 */
export async function ingestReply(input: IngestReplyInput) {
  const lead = await prisma.lead.findUnique({
    where: { email: input.fromEmail },
    select: { id: true },
  });

  let enrollmentId: string | null = null;
  let campaignId: string | null = null;

  if (lead) {
    const enrollment = await prisma.enrollment.findFirst({
      where: { leadId: lead.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, campaignId: true },
    });
    if (enrollment) {
      enrollmentId = enrollment.id;
      campaignId = enrollment.campaignId;
    }
  }

  const body = input.bodyText ?? (input.bodyHtml ? input.bodyHtml.replace(/<[^>]+>/g, " ") : "");

  const result = input.forceCategory
    ? { category: input.forceCategory, confidence: 1, source: "manual" as const }
    : await categorizeReply({ subject: input.subject, body });

  const message = await prisma.inboxMessage.create({
    data: {
      campaignId,
      enrollmentId,
      leadId: lead?.id ?? null,
      fromEmail: input.fromEmail,
      toEmail: input.toEmail ?? null,
      subject: input.subject ?? null,
      bodyText: input.bodyText ?? null,
      bodyHtml: input.bodyHtml ?? null,
      resendEmailId: input.resendEmailId ?? null,
      category: result.category,
      categoryConfidence: result.confidence,
      categorySource: result.source,
      rawJson: input.rawJson ? (input.rawJson as object) : undefined,
    },
  });

  if (enrollmentId) {
    await prisma.sendLog.updateMany({
      where: { enrollmentId, repliedAt: null },
      data: { repliedAt: new Date() },
    });

    if (result.category === "unsubscribe") {
      await prisma.enrollment.update({
        where: { id: enrollmentId },
        data: { status: EnrollmentStatus.unsubscribed },
      });
    }
  }

  return message;
}
