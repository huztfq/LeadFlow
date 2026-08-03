import { getResend } from "@/lib/resend";
import { renderContactNotificationEmail } from "@/lib/email-templates";

/**
 * Best-effort internal notification for a `/contact` form submission.
 * Mirrors `sendInviteEmail` in `src/lib/team.ts`: the message is always
 * persisted to `ContactMessage` first (see `POST /api/contact`), so a failed
 * or unconfigured send here never loses the lead — it just means nobody got
 * pinged and has to check the table.
 */
export async function sendContactNotification(opts: {
  name: string;
  email: string;
  company?: string | null;
  message: string;
}): Promise<{ sent: boolean; error?: string }> {
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.OWNER_EMAIL || from;
  if (!process.env.RESEND_API_KEY || !from || !to) {
    return { sent: false, error: "RESEND_API_KEY / RESEND_FROM_EMAIL not configured" };
  }

  const { subject, html, text } = renderContactNotificationEmail(opts);

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: opts.email,
      subject,
      html,
      text,
    });
    if (error) return { sent: false, error: error.message };
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
