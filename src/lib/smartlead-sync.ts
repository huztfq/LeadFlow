/**
 * Database side of the Smartlead integration (see smartlead.ts for the
 * mapping). Push state lives on the lead: `rawJson.smartlead.campaigns[<lf id>]`
 * records what was pushed where, and `unsubscribedAt` / `bouncedAt` /
 * `repliedAt` come back from the webhook.
 */
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { generatePersonalizedOpener } from "@/lib/personalize";
import { ingestReply } from "@/lib/reply-ingest";
import {
  CAMPAIGN_SETTINGS,
  buildSequences,
  campaignSchedule,
  leadflowIdFromName,
  parseSmartleadWebhook,
  renderLeadForSmartlead,
  smartlead,
  smartleadCampaignName,
  eligibleForPush,
  matchesAudience,
  type AudienceFilter,
  type SmartleadLead,
} from "@/lib/smartlead";
import { EnrollmentStatus } from "@/generated/prisma/enums";

type SlCampaign = { id: number; name: string; status: string };
type SlAccount = { id: number; from_email: string; warmup_details?: { status?: string } | null };
type SlWebhook = { id: number; webhook_url: string };

const WEBHOOK_EVENTS = ["EMAIL_REPLY", "LEAD_UNSUBSCRIBED", "EMAIL_BOUNCE"];
// Smartlead requires at least one category on a webhook; we don't use them.
const WEBHOOK_CATEGORIES = ["Interested"];

export async function findSmartleadCampaign(leadflowCampaignId: string): Promise<SlCampaign | null> {
  const all = await smartlead<SlCampaign[]>("/campaigns/");
  return all.find((c) => leadflowIdFromName(c.name) === leadflowCampaignId) ?? null;
}

async function listMailboxes(): Promise<SlAccount[]> {
  const out: SlAccount[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await smartlead<SlAccount[]>(`/email-accounts/?offset=${offset}&limit=100`);
    out.push(...page);
    if (page.length < 100) return out;
  }
}

function webhookUrl(): string | null {
  const app = process.env.APP_URL;
  const secret = process.env.SMARTLEAD_WEBHOOK_SECRET;
  if (!app || !secret) return null;
  return `${app.replace(/\/$/, "")}/api/webhooks/smartlead?token=${encodeURIComponent(secret)}`;
}

export function webhookTokenValid(token: string | null): boolean {
  const secret = process.env.SMARTLEAD_WEBHOOK_SECRET;
  if (!secret || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function loadCampaign(leadflowCampaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: leadflowCampaignId },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.steps.length === 0) throw new Error("Add at least one step before sending through Smartlead");
  if (campaign.status === "active") {
    throw new Error("This campaign is sending through Leadflow (Resend). Pause it before using Smartlead.");
  }
  return campaign;
}

/**
 * Creates the Smartlead campaign if needed and (re)applies sequence, settings,
 * schedule, mailboxes and the reply webhook. Copy changes only apply while
 * the Smartlead campaign isn't running.
 */
export async function ensureSmartleadCampaign(leadflowCampaignId: string) {
  const campaign = await loadCampaign(leadflowCampaignId);
  let sl = await findSmartleadCampaign(campaign.id);
  if (!sl) {
    const created = await smartlead<{ id: number; name: string }>("/campaigns/create", {
      method: "POST",
      body: { name: smartleadCampaignName(campaign.name, campaign.id) },
    });
    sl = { id: created.id, name: created.name, status: "DRAFTED" };
  }

  const editable = sl.status !== "ACTIVE";
  if (editable) {
    await smartlead(`/campaigns/${sl.id}/sequences`, { method: "POST", body: { sequences: buildSequences(campaign.steps) } });
    await smartlead(`/campaigns/${sl.id}/settings`, { method: "POST", body: CAMPAIGN_SETTINGS });
  }

  const mailboxes = await listMailboxes();
  if (mailboxes.length > 0) {
    await smartlead(`/campaigns/${sl.id}/email-accounts`, {
      method: "POST",
      body: { email_account_ids: mailboxes.map((m) => m.id) },
    });
  }
  await smartlead(`/campaigns/${sl.id}/schedule`, { method: "POST", body: campaignSchedule(mailboxes.length) });

  const url = webhookUrl();
  if (url) {
    const hooks = await smartlead<SlWebhook[]>(`/campaigns/${sl.id}/webhooks`);
    const existing = hooks.find((h) => h.webhook_url.includes("/api/webhooks/smartlead"));
    await smartlead(`/campaigns/${sl.id}/webhooks`, {
      method: "POST",
      body: {
        id: existing?.id ?? null,
        name: "Leadflow replies",
        webhook_url: url,
        event_types: WEBHOOK_EVENTS,
        categories: WEBHOOK_CATEGORIES,
      },
    });
  }

  return { campaign, smartleadCampaign: sl, mailboxes: mailboxes.length, repliesConnected: Boolean(url), copyUpdated: editable };
}

// ---------------------------------------------------------------- picking leads

async function candidateLeads(leadflowCampaignId: string, opts: { leadIds?: string[]; audience?: AudienceFilter }) {
  const select = {
    id: true, email: true, firstName: true, lastName: true, company: true, title: true,
    industry: true, location: true, phone: true, rawJson: true,
    enrollments: { select: { status: true } },
  } as const;
  let ids = opts.leadIds ?? [];
  if (ids.length === 0 && opts.audience) {
    const grades = opts.audience.grades;
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      select id from "Lead"
      where "rawJson"->'audience'->>'grade' = any(${grades}::text[])
      order by "importedAt" asc limit 5000`;
    ids = rows.map((r) => r.id);
  }
  const leads = ids.length ? await prisma.lead.findMany({ where: { id: { in: ids } }, select, orderBy: { importedAt: "asc" } }) : [];
  return leads.filter(
    (l) => eligibleForPush(l, leadflowCampaignId) && (opts.leadIds?.length || (opts.audience && matchesAudience(l.rawJson, opts.audience))),
  );
}

export async function countPushable(leadflowCampaignId: string, opts: { leadIds?: string[]; audience?: AudienceFilter }) {
  return (await candidateLeads(leadflowCampaignId, opts)).length;
}

// ---------------------------------------------------------------- pushing

async function markPushed(leadIds: string[], leadflowCampaignId: string, smartleadCampaignId: number) {
  if (leadIds.length === 0) return;
  await prisma.$executeRaw`
    update "Lead" set "rawJson" = "rawJson" || jsonb_build_object('smartlead',
      coalesce("rawJson"->'smartlead', '{}'::jsonb) || jsonb_build_object('campaigns',
        coalesce("rawJson"->'smartlead'->'campaigns', '{}'::jsonb) || jsonb_build_object(${leadflowCampaignId}::text,
          jsonb_build_object('smartleadCampaignId', ${smartleadCampaignId}::int, 'pushedAt', now()))))
    where id = any(${leadIds}::text[])`;
}

async function markLead(email: string, key: "unsubscribedAt" | "bouncedAt" | "repliedAt") {
  await prisma.$executeRaw`
    update "Lead" set "rawJson" = "rawJson" || jsonb_build_object('smartlead',
      coalesce("rawJson"->'smartlead', '{}'::jsonb) || jsonb_build_object(${key}::text, now()))
    where email = ${email}`;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export type PushResult = {
  smartleadCampaignId: number;
  pushed: number;
  skipped: number;
  remaining: number;
  mailboxes: number;
  repliesConnected: boolean;
};

/**
 * Renders up to `limit` leads (AI opener included) and adds them to the
 * Smartlead campaign. Stops early at `budgetMs` so a request stays inside its
 * time limit; call again while `remaining > 0`.
 */
export async function pushLeadsToSmartlead(
  leadflowCampaignId: string,
  opts: { leadIds?: string[]; audience?: AudienceFilter; limit: number; budgetMs?: number },
): Promise<PushResult> {
  const startedAt = Date.now();
  const budget = opts.budgetMs ?? 75_000;
  const setup = await ensureSmartleadCampaign(leadflowCampaignId);
  const { campaign, smartleadCampaign } = setup;
  const candidates = await candidateLeads(leadflowCampaignId, opts);
  const batchLimit = Math.min(opts.limit, candidates.length);
  const first = campaign.steps[0];

  let pushed = 0;
  let skipped = 0;
  let index = 0;
  // Chunks of 10: openers in parallel, then one Smartlead call per chunk.
  while (index < batchLimit && Date.now() - startedAt < budget) {
    const chunk = candidates.slice(index, Math.min(index + 10, batchLimit));
    index += chunk.length;
    const rendered: { id: string; lead: SmartleadLead }[] = await mapLimit(chunk, 5, async (lead) => {
      const opener = await generatePersonalizedOpener({
        lead,
        campaignName: campaign.name,
        emailSubject: first.subject,
        emailBodyHtml: first.bodyHtml,
      });
      return { id: lead.id, lead: renderLeadForSmartlead(lead, campaign.steps, opener) };
    });
    const result = await smartlead<{ upload_count?: number; invalid_emails?: string[]; unsubscribed_leads?: string[] }>(
      `/campaigns/${smartleadCampaign.id}/leads`,
      {
        method: "POST",
        body: {
          lead_list: rendered.map((r) => r.lead),
          settings: {
            ignore_global_block_list: false,
            ignore_unsubscribe_list: false,
            ignore_community_bounce_list: false,
            ignore_duplicate_leads_in_other_campaign: false,
          },
        },
      },
    );
    // Everything sent was handled (added, or refused as invalid/blocked/duplicate):
    // mark all so a refused lead isn't retried forever.
    await markPushed(rendered.map((r) => r.id), campaign.id, smartleadCampaign.id);
    const uploaded = result.upload_count ?? rendered.length;
    pushed += uploaded;
    skipped += rendered.length - uploaded;
  }

  return {
    smartleadCampaignId: smartleadCampaign.id,
    pushed,
    skipped,
    remaining: candidates.length - index,
    mailboxes: setup.mailboxes,
    repliesConnected: setup.repliesConnected,
  };
}

// ---------------------------------------------------------------- status & control

export async function smartleadStatus(leadflowCampaignId: string) {
  const sl = await findSmartleadCampaign(leadflowCampaignId);
  const [allMailboxes, leads, attached] = await Promise.all([
    listMailboxes(),
    sl ? smartlead<{ total_leads?: string | number }>(`/campaigns/${sl.id}/leads?offset=0&limit=1`) : null,
    sl ? smartlead<SlAccount[]>(`/campaigns/${sl.id}/email-accounts`) : null,
  ]);
  return {
    campaign: sl ? { id: sl.id, name: sl.name, status: sl.status } : null,
    leads: Number(leads?.total_leads ?? 0),
    mailboxesAttached: attached?.length ?? 0,
    mailboxesTotal: allMailboxes.length,
    warmingUp: allMailboxes.filter((m) => m.warmup_details?.status === "ACTIVE").length,
    repliesConnected: Boolean(webhookUrl()),
  };
}

export async function setSmartleadStatus(leadflowCampaignId: string, status: "START" | "PAUSED") {
  const sl = await findSmartleadCampaign(leadflowCampaignId);
  if (!sl) throw new Error("Push leads to Smartlead first");
  if (status === "START") {
    // Smartlead accepts START with no mailboxes; refuse here so "started" means sending.
    const attached = await smartlead<SlAccount[]>(`/campaigns/${sl.id}/email-accounts`);
    if (attached.length === 0) throw new Error("Connect at least one mailbox in Smartlead, then push again to attach it");
  }
  await smartlead(`/campaigns/${sl.id}/status`, { method: "POST", body: { status } });
}

// ---------------------------------------------------------------- webhook

export async function handleSmartleadWebhook(body: unknown) {
  const event = parseSmartleadWebhook(body);
  if (!event.leadEmail) return { handled: false, reason: "no lead email" };

  if (event.type === "reply") {
    // Smartlead retries deliveries; one inbox message per reply.
    if (event.messageId) {
      const dup = await prisma.inboxMessage.findFirst({
        where: { rawJson: { path: ["reply_message", "message_id"], equals: event.messageId } },
        select: { id: true },
      });
      if (dup) return { handled: true, duplicate: true };
    }
    await markLead(event.leadEmail, "repliedAt");
    const message = await ingestReply({
      fromEmail: event.leadEmail,
      toEmail: event.mailbox,
      subject: event.subject,
      bodyText: event.text,
      bodyHtml: event.html,
      rawJson: body,
      campaignId: event.leadflowCampaignId,
    });
    return { handled: true, inboxMessageId: message.id };
  }

  if (event.type === "unsubscribe" || event.type === "bounce") {
    await markLead(event.leadEmail, event.type === "unsubscribe" ? "unsubscribedAt" : "bouncedAt");
    await prisma.enrollment.updateMany({
      where: { lead: { email: event.leadEmail }, status: EnrollmentStatus.active },
      data: { status: event.type === "unsubscribe" ? EnrollmentStatus.unsubscribed : EnrollmentStatus.bounced },
    });
    return { handled: true };
  }

  return { handled: false, reason: `ignored ${event.rawType}` };
}
