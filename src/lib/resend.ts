import { Resend } from "resend";
import { htmlToText } from "@/lib/campaign-email";

export function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

export type SendCampaignEmailError = Error & {
  transient?: boolean;
  statusCode?: number | null;
  code?: string;
};

export type SendCampaignEmailOptions = {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative. Derived from `html` when omitted. */
  text?: string;
  /** Where replies land. Defaults to REPLY_TO_EMAIL, then the address in RESEND_FROM_EMAIL. */
  replyTo?: string;
  /** Signed https unsubscribe URL; emitted as RFC 8058 one-click List-Unsubscribe headers. */
  unsubscribeUrl?: string;
  /** ISO 8601 timestamp; Resend holds the email until then. */
  scheduledAt?: string;
};

/** Address portion of a `Name <addr>` header, or the raw string. */
export function fromAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}

export function buildListUnsubscribeHeaders(input: {
  unsubscribeUrl?: string;
  mailto?: string;
}): Record<string, string> {
  const targets: string[] = [];
  if (input.unsubscribeUrl) targets.push(`<${input.unsubscribeUrl}>`);
  if (input.mailto) targets.push(`<mailto:${input.mailto}?subject=unsubscribe>`);
  if (targets.length === 0) return {};
  const headers: Record<string, string> = { "List-Unsubscribe": targets.join(", ") };
  if (input.unsubscribeUrl) headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  return headers;
}

export async function sendCampaignEmail(opts: SendCampaignEmailOptions): Promise<{ id: string }> {
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL is not set");

  const replyTo = opts.replyTo ?? process.env.REPLY_TO_EMAIL ?? fromAddress(from);

  const { data, error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? htmlToText(opts.html),
    replyTo,
    headers: buildListUnsubscribeHeaders({ unsubscribeUrl: opts.unsubscribeUrl, mailto: replyTo }),
    ...(opts.scheduledAt ? { scheduledAt: opts.scheduledAt } : {}),
  });

  if (error) {
    const err = new Error(error.message) as SendCampaignEmailError;
    err.statusCode = error.statusCode;
    err.code = error.name;
    err.transient = isTransientStatus(error.statusCode);
    throw err;
  }

  return { id: data?.id ?? "" };
}

export function isTransientStatus(statusCode: number | null | undefined): boolean {
  if (statusCode == null) return false;
  if (statusCode === 429) return true;
  return statusCode >= 500;
}
