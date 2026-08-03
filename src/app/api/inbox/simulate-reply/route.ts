import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ingestReply } from "@/lib/reply-ingest";

/**
 * Session-gated dev/demo helper: inserts a reply as if it had arrived
 * inbound, then runs it through the same AI-categorization path a real
 * inbound webhook would use. Exists because Resend has no inbound-email
 * webhook today (see the note in `/api/webhooks/resend`), so this is the
 * tested path for exercising the Inbox locally.
 */

const simulateSchema = z.object({
  leadId: z.string().trim().min(1).optional(),
  subject: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1).optional(),
});

const SAMPLE_REPLIES = [
  { subject: "Re: quick question", body: "This looks interesting, can you tell me more about pricing?" },
  { subject: "Re: intro", body: "Thanks but we're not interested right now." },
  { subject: "Re: intro", body: "Sure, I'm free — can we book a call for Thursday at 2pm?" },
  { subject: "Automatic reply: Out of office", body: "I'm out of office until Monday. I'll respond when I'm back." },
  { subject: "Re: intro", body: "Please unsubscribe me from this list, stop emailing me." },
];

export async function POST(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    // Empty body is fine — pick a random sample below.
  }

  const parsed = simulateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { leadId, subject, body } = parsed.data;

  const lead = leadId
    ? await prisma.lead.findUnique({ where: { id: leadId } })
    : await prisma.lead.findFirst({ where: { email: { not: null } }, orderBy: { importedAt: "desc" } });

  if (!lead?.email) {
    return NextResponse.json(
      { error: "No lead with an email address to simulate a reply from. Import some contacts first." },
      { status: 400 },
    );
  }

  const sample = SAMPLE_REPLIES[Math.floor(Math.random() * SAMPLE_REPLIES.length)];

  const message = await ingestReply({
    fromEmail: lead.email,
    toEmail: process.env.RESEND_FROM_EMAIL ?? null,
    subject: subject ?? sample.subject,
    bodyText: body ?? sample.body,
    rawJson: { simulated: true },
  });

  return NextResponse.json({ message }, { status: 201 });
}
