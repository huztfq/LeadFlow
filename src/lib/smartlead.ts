/**
 * Smartlead (cold email sending): Resend's terms forbid cold outreach, so
 * Leadflow picks and personalizes leads, and Smartlead sends them from warmed
 * mailboxes. Replies come back through /api/webhooks/smartlead.
 *
 * How a Leadflow campaign maps onto Smartlead (no extra DB columns):
 * - One Smartlead campaign per Leadflow campaign, found by the `[lf:<id>]` tag
 *   in its name.
 * - Each lead is rendered in Leadflow (merge fields, AI opener, booking link)
 *   and pushed with the finished copy in custom fields `lf_subject_N` /
 *   `lf_body_N`; the Smartlead sequence is just `{{lf_body_N}}`.
 * - Follow-ups reply in the same thread unless the step has its own subject.
 *
 * API: https://server.smartlead.ai/api/v1, `api_key` query param.
 */
import { appendBookingCta } from "@/lib/campaign-email";
import {
  ensureOpenerSlot,
  renderTemplate,
  speedAuditFields,
  stripEmptyOpenerParagraphs,
} from "@/lib/merge-fields";

const BASE = "https://server.smartlead.ai/api/v1";

export function smartleadConfigured() {
  return Boolean(process.env.SMARTLEAD_API_KEY);
}

export class SmartleadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function smartlead<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const key = process.env.SMARTLEAD_API_KEY;
  if (!key) throw new SmartleadError("SMARTLEAD_API_KEY is not set", 500);
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(key)}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(30_000),
    });
    // Rate limit is about 10 requests / 2 seconds.
    if (res.status === 429 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    const text = await res.text();
    if (!res.ok) {
      let message = text.slice(0, 300);
      try {
        const json = JSON.parse(text) as { message?: string; error?: string };
        message = json.message ?? json.error ?? message;
      } catch {}
      throw new SmartleadError(`Smartlead ${res.status}: ${message}`, res.status);
    }
    return (text ? JSON.parse(text) : null) as T;
  }
}

// ---------------------------------------------------------------- naming

export function smartleadCampaignName(name: string, leadflowCampaignId: string) {
  return `${name} [lf:${leadflowCampaignId}]`;
}

export function leadflowIdFromName(name: string | null | undefined): string | null {
  return name?.match(/\[lf:([a-z0-9]+)\]\s*$/i)?.[1] ?? null;
}

// ---------------------------------------------------------------- copy

export type StepLike = { stepOrder: number; delayDays: number; subject: string; bodyHtml: string };

function sortSteps(steps: StepLike[]) {
  return steps.slice().sort((a, b) => a.stepOrder - b.stepOrder);
}

/** A follow-up stays in the first email's thread unless it has a subject of its own. */
export function threadsWithFirst(step: StepLike, first: StepLike) {
  const s = step.subject.trim();
  return !s || /^re:/i.test(s) || s === first.subject.trim();
}

export type SmartleadSequence = {
  seq_number: number;
  seq_delay_details: { delay_in_days: number };
  subject: string;
  email_body: string;
};

export function buildSequences(steps: StepLike[]): SmartleadSequence[] {
  const sorted = sortSteps(steps);
  return sorted.map((step, i) => ({
    seq_number: i + 1,
    seq_delay_details: { delay_in_days: i === 0 ? 0 : Math.max(1, step.delayDays) },
    subject: i === 0 || !threadsWithFirst(step, sorted[0]) ? `{{lf_subject_${i + 1}}}` : "",
    email_body: `{{lf_body_${i + 1}}}`,
  }));
}

export type LeadLike = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  title: string | null;
  industry: string | null;
  location: string | null;
  phone: string | null;
  rawJson: unknown;
};

export type SmartleadLead = {
  email: string;
  first_name: string;
  last_name: string;
  company_name: string;
  website: string;
  location: string;
  phone_number: string;
  custom_fields: Record<string, string>;
};

function websiteOf(rawJson: unknown): string {
  const org = (rawJson as { organization?: { website_url?: unknown } } | null)?.organization;
  return typeof org?.website_url === "string" ? org.website_url : "";
}

/** The finished copy for one lead, exactly as Leadflow would have sent it. */
export function renderLeadForSmartlead(lead: LeadLike, steps: StepLike[], opener: string): SmartleadLead {
  const fields = {
    firstName: lead.firstName,
    lastName: lead.lastName,
    company: lead.company,
    title: lead.title,
    industry: lead.industry,
    location: lead.location,
    opener,
    ...speedAuditFields(lead.rawJson),
  };
  const custom: Record<string, string> = { lf_lead_id: lead.id };
  sortSteps(steps).forEach((step, i) => {
    const template = opener && i === 0 ? ensureOpenerSlot(step.bodyHtml) : step.bodyHtml;
    custom[`lf_subject_${i + 1}`] = renderTemplate(step.subject, fields);
    custom[`lf_body_${i + 1}`] = appendBookingCta(stripEmptyOpenerParagraphs(renderTemplate(template, fields)));
  });
  return {
    email: lead.email ?? "",
    first_name: lead.firstName ?? "",
    last_name: lead.lastName ?? "",
    company_name: lead.company ?? "",
    website: websiteOf(lead.rawJson),
    location: lead.location ?? "",
    phone_number: lead.phone ?? "",
    custom_fields: custom,
  };
}

// ---------------------------------------------------------------- campaign defaults

/** No open/click tracking (hurts cold deliverability), stop on reply, weekdays 8–5 Central. */
export const CAMPAIGN_SETTINGS = {
  track_settings: ["DONT_EMAIL_OPEN", "DONT_LINK_CLICK"],
  stop_lead_settings: "REPLY_TO_AN_EMAIL",
  send_as_plain_text: false,
  follow_up_percentage: 100,
  unsubscribe_text: "Don't want these emails? Unsubscribe",
};

export function campaignSchedule(mailboxes: number) {
  return {
    timezone: "America/Chicago",
    days_of_the_week: [1, 2, 3, 4, 5],
    start_hour: "08:00",
    end_hour: "17:00",
    min_time_btw_emails: 10,
    // New people per day; follow-ups come on top. ~20 per warmed mailbox.
    max_new_leads_per_day: Math.max(10, 20 * mailboxes),
  };
}

// ---------------------------------------------------------------- picking leads

export type AudienceFilter = { grades: string[]; segment?: string | null };

type SmartleadState = {
  campaigns?: Record<string, { smartleadCampaignId: number; pushedAt: string }>;
  unsubscribedAt?: string;
  bouncedAt?: string;
  repliedAt?: string;
};

function stateOf(rawJson: unknown): SmartleadState {
  const s = (rawJson as { smartlead?: unknown } | null)?.smartlead;
  return s && typeof s === "object" ? (s as SmartleadState) : {};
}

function audienceOf(rawJson: unknown): { grade?: string; segment?: string } {
  const a = (rawJson as { audience?: unknown } | null)?.audience;
  return a && typeof a === "object" ? (a as { grade?: string; segment?: string }) : {};
}

/** Leads that may go into this campaign: have an email, never opted out, bounced or replied, not pushed yet. */
export function eligibleForPush(
  lead: { email: string | null; rawJson: unknown; enrollments: { status: string }[] },
  leadflowCampaignId: string,
): boolean {
  if (!lead.email) return false;
  const state = stateOf(lead.rawJson);
  if (state.unsubscribedAt || state.bouncedAt || state.repliedAt) return false;
  if (state.campaigns?.[leadflowCampaignId]) return false;
  return !lead.enrollments.some((e) => e.status === "unsubscribed" || e.status === "bounced");
}

export function matchesAudience(rawJson: unknown, filter: AudienceFilter): boolean {
  const a = audienceOf(rawJson);
  if (!a.grade || !filter.grades.includes(a.grade)) return false;
  return !filter.segment || a.segment === filter.segment;
}

// ---------------------------------------------------------------- webhooks

export type SmartleadEvent = {
  type: "reply" | "unsubscribe" | "bounce" | "other";
  rawType: string;
  leadEmail: string | null;
  smartleadCampaignId: number | null;
  leadflowCampaignId: string | null;
  subject: string | null;
  text: string | null;
  html: string | null;
  messageId: string | null;
  mailbox: string | null;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Normalises a Smartlead webhook payload; field names vary between event types. */
export function parseSmartleadWebhook(body: unknown): SmartleadEvent {
  const b = (body ?? {}) as Record<string, unknown>;
  const rawType = str(b.event_type) ?? str(b.type) ?? "";
  const reply = (b.reply_message ?? {}) as Record<string, unknown>;
  const leadData = (b.lead_data ?? b.lead ?? {}) as Record<string, unknown>;
  const type: SmartleadEvent["type"] =
    rawType === "EMAIL_REPLY" ? "reply"
    : rawType === "LEAD_UNSUBSCRIBED" ? "unsubscribe"
    : rawType === "EMAIL_BOUNCE" || rawType === "EMAIL_BOUNCED" ? "bounce"
    : "other";
  const campaignId = Number(b.campaign_id);
  const leadEmail = (str(b.sl_lead_email) ?? str(b.lead_email) ?? str(leadData.email))?.toLowerCase() ?? null;
  // from/to swap depending on direction; the mailbox is whichever isn't the lead.
  const mailbox = [str(b.to_email), str(b.from_email)].find((e) => e && e.toLowerCase() !== leadEmail) ?? null;
  return {
    type,
    rawType,
    leadEmail,
    smartleadCampaignId: Number.isFinite(campaignId) && campaignId > 0 ? campaignId : null,
    leadflowCampaignId: leadflowIdFromName(str(b.campaign_name)),
    subject: str(b.subject) ?? str(reply.subject),
    text: str(reply.text) ?? str(b.reply_body) ?? str(b.preview_text),
    html: str(reply.html),
    messageId: str(reply.message_id) ?? str(b.message_id) ?? str(b.stats_id),
    mailbox,
  };
}
