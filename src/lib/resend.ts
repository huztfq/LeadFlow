import { Resend } from "resend";

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

export async function sendCampaignEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ id: string }> {
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL is not set");

  const { data, error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
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
