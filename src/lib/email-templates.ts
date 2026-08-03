/**
 * Shared HTML/text email templates for transactional mail sent via Resend.
 * Keep markup table-based with inline styles only — this needs to survive
 * Outlook/Gmail's stripped-down CSS support, not just modern browsers.
 */

const BRAND = {
  ink: "#0f2744",
  inkSoft: "#334e68",
  muted: "#627d98",
  line: "#d9e2ec",
  paper: "#eef2f6",
  signal: "#0f766e",
  signalDeep: "#115e59",
  signalSoft: "#ccfbf1",
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatExpiry(expiresAt: Date): string {
  return expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Wraps templated inner content in the shared header/footer chrome every transactional email uses. */
function emailShell(opts: { previewText: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Leadflow</title>
  </head>
  <body style="margin:0;padding:0;background-color:${BRAND.paper};-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
      ${escapeHtml(opts.previewText)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.paper};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BRAND.line};">
            <tr>
              <td style="padding:28px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.01em;">
                      Leadflow
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:2px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.signal};">
                      A product of Inferaform
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${opts.bodyHtml}
            <tr>
              <td style="padding:24px 40px 32px 40px;border-top:1px solid ${BRAND.line};">
                <p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${BRAND.muted};">
                  Sent by Leadflow, a product of Inferaform.
                </p>
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${BRAND.muted};">
                  Didn&rsquo;t expect this email? You can safely ignore it &mdash; no account will be created.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export type InviteEmailContent = { subject: string; html: string; text: string };

/** Renders the "you've been invited" transactional email (HTML + plain-text fallback). */
export function renderInviteEmail(opts: {
  inviteeEmail: string;
  inviterName?: string | null;
  inviterEmail?: string | null;
  acceptUrl: string;
  expiresAt: Date;
}): InviteEmailContent {
  const { inviteeEmail, acceptUrl, expiresAt } = opts;
  const inviter = (opts.inviterName?.trim() || opts.inviterEmail?.trim() || null) as string | null;
  const expiry = formatExpiry(expiresAt);

  const subject = "You're invited to join Leadflow";

  const inviterLine = inviter
    ? `<strong style="color:${BRAND.ink};">${escapeHtml(inviter)}</strong> invited you to join their Leadflow workspace.`
    : "You&rsquo;ve been invited to join a Leadflow workspace.";

  const features = [
    ["Studio", "Plan outreach sequences with an AI co-pilot, step by step."],
    ["Campaigns", "Launch and monitor sends, opens, and replies in one place."],
    ["Contacts", "Search, enrich, and import leads straight from Apollo."],
  ];

  const bodyHtml = `
            <tr>
              <td style="padding:28px 40px 8px 40px;">
                <h1 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:32px;font-weight:700;color:${BRAND.ink};">
                  You&rsquo;re invited to Leadflow
                </h1>
                <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:${BRAND.inkSoft};">
                  ${inviterLine}
                </p>
                <p style="margin:0 0 24px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:${BRAND.inkSoft};">
                  Leadflow helps small teams design outreach together &mdash; plan a sequence, enrich Apollo leads, send via Resend, and triage replies from one shared pipeline.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 40px 28px 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="border-radius:10px;background:linear-gradient(180deg,#14968c,${BRAND.signal});box-shadow:0 10px 24px rgba(15,118,110,0.28);">
                      <a href="${acceptUrl}" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                        Accept invite
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${BRAND.muted};word-break:break-all;">
                  Or copy this link: <a href="${acceptUrl}" style="color:${BRAND.signal};">${escapeHtml(acceptUrl)}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 28px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.paper};border-radius:12px;">
                  <tr>
                    <td style="padding:20px 24px;">
                      <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.muted};">
                        What you&rsquo;ll get access to
                      </p>
                      ${features
                        .map(
                          ([title, desc], index) => `
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${index > 0 ? "margin-top:10px;" : ""}">
                        <tr>
                          <td width="8" valign="top" style="padding-top:6px;">
                            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background-color:${BRAND.signal};"></span>
                          </td>
                          <td style="padding-left:10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:${BRAND.inkSoft};">
                            <strong style="color:${BRAND.ink};">${escapeHtml(title)}</strong> &mdash; ${escapeHtml(desc)}
                          </td>
                        </tr>
                      </table>`,
                        )
                        .join("")}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 8px 40px;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${BRAND.muted};">
                  This invite was sent to ${escapeHtml(inviteeEmail)} and expires on ${expiry}.
                </p>
              </td>
            </tr>`;

  const html = emailShell({
    previewText: `${inviter ? `${inviter} invited you` : "You're invited"} to join Leadflow — accept to get started.`,
    bodyHtml,
  });

  const text = [
    "You're invited to Leadflow",
    "",
    inviter ? `${inviter} invited you to join their Leadflow workspace.` : "You've been invited to join a Leadflow workspace.",
    "",
    "Leadflow helps small teams design outreach together \u2014 plan a sequence, enrich Apollo leads, send via Resend, and triage replies from one shared pipeline.",
    "",
    `Accept your invite: ${acceptUrl}`,
    "",
    "What you'll get access to:",
    ...features.map(([title, desc]) => `  - ${title}: ${desc}`),
    "",
    `This invite was sent to ${inviteeEmail} and expires on ${expiry}.`,
    "If you weren't expecting this, you can safely ignore it \u2014 no account will be created.",
    "",
    "Sent by Leadflow, a product of Inferaform.",
  ].join("\n");

  return { subject, html, text };
}

export type ContactNotificationContent = { subject: string; html: string; text: string };

/** Renders the internal notification email sent when someone submits the public `/contact` form. */
export function renderContactNotificationEmail(opts: {
  name: string;
  email: string;
  company?: string | null;
  message: string;
}): ContactNotificationContent {
  const { name, email, company, message } = opts;
  const subject = `New contact form message from ${name}`;

  const rows: Array<[string, string]> = [
    ["Name", name],
    ["Email", email],
    ...(company ? ([["Company", company]] as Array<[string, string]>) : []),
  ];

  const bodyHtml = `
            <tr>
              <td style="padding:28px 40px 8px 40px;">
                <h1 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:30px;font-weight:700;color:${BRAND.ink};">
                  New message from the contact form
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 16px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.paper};border-radius:12px;">
                  <tr>
                    <td style="padding:18px 22px;">
                      ${rows
                        .map(
                          ([label, value]) => `
                      <p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:${BRAND.inkSoft};">
                        <strong style="color:${BRAND.ink};">${escapeHtml(label)}:</strong> ${escapeHtml(value)}
                      </p>`,
                        )
                        .join("")}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 28px 40px;">
                <p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.muted};">
                  Message
                </p>
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:${BRAND.inkSoft};white-space:pre-wrap;">${escapeHtml(message)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 8px 40px;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${BRAND.muted};">
                  Reply directly to this email to respond to ${escapeHtml(name)}.
                </p>
              </td>
            </tr>`;

  const html = emailShell({
    previewText: `${name} sent a message via the Leadflow contact form.`,
    bodyHtml,
  });

  const text = [
    "New message from the contact form",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Message:",
    message,
    "",
    `Reply directly to ${email} to respond.`,
  ].join("\n");

  return { subject, html, text };
}
