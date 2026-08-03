import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyResendWebhookSignature } from "@/lib/resend-webhook";

/**
 * Resend webhook receiver. Configure this in the Resend dashboard
 * (Webhooks → Add endpoint) pointed at `${APP_URL}/api/webhooks/resend`,
 * subscribed to at least: email.opened, email.clicked, email.bounced,
 * email.delivered, email.complained.
 *
 * Resend does not currently offer inbound-email (reply) webhooks — there's no
 * `email.replied` event, since Resend is a sending-only API with no MX/receive
 * side. That's why replies in this app come through
 * `POST /api/inbox/simulate-reply` (session-gated, for local demo) rather
 * than this endpoint. If Resend (or a receiving-domain add-on) ever ships
 * inbound events, or you wire a third-party inbound-parse webhook, route its
 * normalized payload through `ingestReply()` in `src/lib/reply-ingest.ts` —
 * this handler is a reasonable place to add that branch later.
 */

type ResendWebhookEvent = {
  type: string;
  data: {
    email_id?: string;
    to?: string[] | string;
    from?: string;
    subject?: string;
    click?: { link?: string };
  };
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const svixHeaders = {
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
  };

  if (secret) {
    if (!verifyResendWebhookSignature(rawBody, svixHeaders, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    // Local dev without a configured secret: accept unsigned requests so the
    // webhook can be exercised with a plain curl/Resend test event, but make
    // the gap loud in the server logs. Always set RESEND_WEBHOOK_SECRET in
    // production — see README.
    console.warn("[webhooks/resend] RESEND_WEBHOOK_SECRET is not set — accepting unverified webhook payload");
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const emailId = event.data?.email_id;

  switch (event.type) {
    case "email.opened": {
      if (emailId) {
        const existing = await prisma.sendLog.findFirst({ where: { resendId: emailId } });
        if (existing) {
          await prisma.sendLog.update({
            where: { id: existing.id },
            data: {
              openedAt: existing.openedAt ?? new Date(),
              openCount: { increment: 1 },
            },
          });
        }
      }
      break;
    }
    case "email.clicked": {
      if (emailId) {
        await prisma.sendLog.updateMany({
          where: { resendId: emailId, clickedAt: null },
          data: { clickedAt: new Date() },
        });
      }
      break;
    }
    case "email.bounced": {
      if (emailId) {
        await prisma.sendLog.updateMany({
          where: { resendId: emailId, bouncedAt: null },
          data: { bouncedAt: new Date() },
        });
      }
      break;
    }
    default:
      // email.sent / email.delivered / email.delivery_delayed / email.complained
      // and anything else: no-op, acknowledged with 200 so Resend doesn't retry.
      break;
  }

  return NextResponse.json({ received: true });
}
