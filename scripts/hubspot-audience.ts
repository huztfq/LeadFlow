/**
 * HubSpot → Inferaform audience.
 *
 *   node --env-file=.env scripts/hubspot-audience.ts [options]
 *
 * 1. Pulls contacts + their companies from HubSpot (read-only, HUBSPOT_TOKEN:
 *    a private app with crm.objects.contacts.read + crm.objects.companies.read).
 * 2. Drops anyone we must not email (customers, unsubscribed, bounced, recently
 *    contacted, outside US/Canada, wrong size) and keeps up to 2 people per company.
 * 3. Checks each company's website (ads tags, follow-up tools, Shopify stock).
 * 4. Grades A/B/C and writes out/hubspot-audience/audience.{json,csv}.
 *
 * Options:
 *   --limit N          only pull the first N contacts (testing)
 *   --from-cache       reuse the last HubSpot pull (out/hubspot-audience/hubspot.json)
 *   --no-site          skip website checks (grades everything C)
 *   --import           upsert graded leads into Leadflow (DATABASE_URL)
 *   --grades A,B       which grades --import takes (default A,B)
 *   --campaign ID      also enroll imported leads into this campaign; it must be a
 *                      draft or paused campaign, and stays that way (nothing sends)
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  classifySegment,
  detectSiteSignals,
  exclusionReason,
  pickContacts,
  scoreAudience,
  siteUrl,
  storeFactsFromProducts,
  unreachableSignals,
  type Grade,
  type HubSpotCompany,
  type HubSpotContact,
  type Segment,
  type SiteSignals,
  type StoreFacts,
} from "../src/lib/hubspot-audience.ts";

const OUT = path.join(process.cwd(), "out", "hubspot-audience");
const HUBSPOT = "https://api.hubapi.com";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- HubSpot

async function hubspot<T>(pathname: string, init?: RequestInit): Promise<T> {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) throw new Error("HUBSPOT_TOKEN is not set (add it to .env)");
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${HUBSPOT}${pathname}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
    });
    if (res.status === 429 && attempt < 5) {
      await sleep(Number(res.headers.get("retry-after") ?? 2) * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`HubSpot ${res.status} on ${pathname}: ${(await res.text()).slice(0, 300)}`);
    return (await res.json()) as T;
  }
}

type HsObject = { id: string; properties: Record<string, string | null> };

const CONTACT_PROPS = [
  "email", "firstname", "lastname", "jobtitle", "phone", "city", "state", "country",
  "lifecyclestage", "hs_email_optout", "hs_email_hard_bounce_reason_enum",
  "notes_last_contacted", "hs_last_sales_activity_timestamp", "associatedcompanyid",
];
const COMPANY_PROPS = [
  "name", "domain", "website", "industry", "description", "numberofemployees",
  "city", "state", "country", "lifecyclestage",
];

function toContact(o: HsObject): HubSpotContact {
  const p = o.properties;
  const lastContacted = [p.notes_last_contacted, p.hs_last_sales_activity_timestamp]
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1) ?? null;
  return {
    id: o.id,
    email: p.email?.trim().toLowerCase() || null,
    firstName: p.firstname || null,
    lastName: p.lastname || null,
    jobTitle: p.jobtitle || null,
    phone: p.phone || null,
    city: p.city || null,
    state: p.state || null,
    country: p.country || null,
    lifecycleStage: p.lifecyclestage || null,
    optedOut: p.hs_email_optout === "true",
    hardBounced: Boolean(p.hs_email_hard_bounce_reason_enum),
    lastContactedAt: lastContacted,
    companyId: p.associatedcompanyid || null,
  };
}

function toCompany(o: HsObject): HubSpotCompany {
  const p = o.properties;
  const employees = Number(p.numberofemployees);
  return {
    id: o.id,
    name: p.name || null,
    domain: p.domain || null,
    website: p.website || null,
    industry: p.industry || null,
    description: p.description || null,
    employees: p.numberofemployees && Number.isFinite(employees) ? employees : null,
    city: p.city || null,
    state: p.state || null,
    country: p.country || null,
    lifecycleStage: p.lifecyclestage || null,
  };
}

async function pullHubSpot(limit: number | null) {
  const contacts: HubSpotContact[] = [];
  let after: string | undefined;
  do {
    const q = new URLSearchParams({ limit: "100", properties: CONTACT_PROPS.join(",") });
    if (after) q.set("after", after);
    const page = await hubspot<{ results: HsObject[]; paging?: { next?: { after: string } } }>(
      `/crm/v3/objects/contacts?${q}`,
    );
    contacts.push(...page.results.map(toContact));
    after = page.paging?.next?.after;
    process.stdout.write(`\rHubSpot contacts: ${contacts.length}`);
    await sleep(120);
  } while (after && (limit == null || contacts.length < limit));
  if (limit != null) contacts.length = Math.min(contacts.length, limit);
  process.stdout.write("\n");

  const ids = [...new Set(contacts.map((c) => c.companyId).filter((id): id is string => Boolean(id)))];
  const companies: HubSpotCompany[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const batch = await hubspot<{ results: HsObject[] }>("/crm/v3/objects/companies/batch/read", {
      method: "POST",
      body: JSON.stringify({ properties: COMPANY_PROPS, inputs: ids.slice(i, i + 100).map((id) => ({ id })) }),
    });
    companies.push(...batch.results.map(toCompany));
    process.stdout.write(`\rHubSpot companies: ${companies.length}/${ids.length}`);
    await sleep(120);
  }
  process.stdout.write("\n");
  return { pulledAt: new Date().toISOString(), contacts, companies };
}

// ---------------------------------------------------------------- website

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

async function getText(url: string, maxBytes = 2_000_000): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, maxBytes);
  } catch {
    return null;
  }
}

async function checkSite(site: string): Promise<{ signals: SiteSignals; store: StoreFacts | null }> {
  let origin = site;
  let html = await getText(origin);
  // Some apex domains don't resolve or answer; their www host usually does.
  if (!html && !new URL(site).hostname.startsWith("www.")) {
    origin = site.replace("https://", "https://www.");
    html = await getText(origin);
  }
  if (!html) return { signals: unreachableSignals(), store: null };
  const signals = detectSiteSignals(html);
  let store: StoreFacts | null = null;
  if (signals.shopify) {
    const json = await getText(`${origin}/products.json?limit=250`, 8_000_000);
    try {
      const products = json ? (JSON.parse(json) as { products?: unknown[] }).products : null;
      if (Array.isArray(products)) store = storeFactsFromProducts(products as never[], signals.backInStock);
    } catch {
      // Not JSON (password page, bot wall): no store facts.
    }
  }
  return { signals, store };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

// ---------------------------------------------------------------- main

type Row = {
  contact: HubSpotContact;
  company: HubSpotCompany | null;
  segment: Segment | null;
  excluded: string | null;
  website: string | null;
  signals: SiteSignals | null;
  store: StoreFacts | null;
  grade: Grade | null;
  reasons: string[];
};

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const cacheFile = path.join(OUT, "hubspot.json");
  const limit = option("limit") ? Number(option("limit")) : null;

  let pull: Awaited<ReturnType<typeof pullHubSpot>>;
  if (flag("from-cache")) {
    if (!existsSync(cacheFile)) throw new Error(`No cache at ${cacheFile}; run once without --from-cache`);
    pull = JSON.parse(readFileSync(cacheFile, "utf8"));
    console.log(`Using cached pull from ${pull.pulledAt}: ${pull.contacts.length} contacts`);
  } else {
    pull = await pullHubSpot(limit);
    writeFileSync(cacheFile, JSON.stringify(pull));
  }

  const companyById = new Map(pull.companies.map((c) => [c.id, c]));
  const rows: Row[] = pull.contacts.map((contact) => {
    const company = contact.companyId ? companyById.get(contact.companyId) ?? null : null;
    return {
      contact,
      company,
      segment: null,
      excluded: exclusionReason(contact, company),
      website: siteUrl(company) ?? (contact.email ? siteUrl({ domain: contact.email.split("@")[1] } as HubSpotCompany) : null),
      signals: null,
      store: null,
      grade: null,
      reasons: [],
    };
  });

  // Free-mail addresses don't point at a business website.
  const FREEMAIL = /^https:\/\/(gmail|yahoo|hotmail|outlook|icloud|aol|live|msn|me|proton|protonmail)\./i;
  for (const r of rows) if (r.website && FREEMAIL.test(r.website) && !r.company) r.website = null;

  // Website checks, once per site, only for people still in the running.
  const sites = [...new Set(rows.filter((r) => !r.excluded && r.website).map((r) => r.website!))];
  const checked = new Map<string, Awaited<ReturnType<typeof checkSite>>>();
  if (!flag("no-site")) {
    let done = 0;
    await mapLimit(sites, 8, async (site) => {
      checked.set(site, await checkSite(site));
      process.stdout.write(`\rWebsites checked: ${++done}/${sites.length}`);
    });
    process.stdout.write("\n");
  }

  for (const r of rows) {
    const site = r.website ? checked.get(r.website) : undefined;
    r.signals = site?.signals ?? null;
    r.store = site?.store ?? null;
    if (r.excluded) continue;
    r.segment = classifySegment(r.company, r.signals);
    if (!r.segment) {
      r.excluded = "not ecommerce or local service";
      continue;
    }
    const score = r.signals ? scoreAudience(r.segment, r.signals, r.store) : { grade: "C" as Grade, reasons: ["website not checked"] };
    r.grade = score.grade;
    r.reasons = score.reasons;
  }

  // Up to 2 people per company.
  const byCompany = new Map<string, Row[]>();
  for (const r of rows) {
    if (r.excluded || !r.segment) continue;
    const key = r.company?.id ?? r.website ?? r.contact.id;
    byCompany.set(key, [...(byCompany.get(key) ?? []), r]);
  }
  for (const group of byCompany.values()) {
    const keep = new Set(pickContacts(group, group[0].segment!));
    for (const r of group) if (!keep.has(r)) { r.excluded = "another contact at this company picked"; r.grade = null; }
  }

  writeFileSync(path.join(OUT, "audience.json"), JSON.stringify(rows, null, 2));
  const header = ["grade", "segment", "email", "first_name", "last_name", "title", "company", "website", "reasons", "excluded"];
  const lines = [...rows]
    .sort((a, b) => (a.grade ?? "Z").localeCompare(b.grade ?? "Z"))
    .map((r) =>
      [r.grade, r.segment, r.contact.email, r.contact.firstName, r.contact.lastName, r.contact.jobTitle,
        r.company?.name, r.website, r.reasons.join("; "), r.excluded].map(csvCell).join(","),
    );
  writeFileSync(path.join(OUT, "audience.csv"), [header.join(","), ...lines].join("\n"));

  const count = (f: (r: Row) => boolean) => rows.filter(f).length;
  console.log("\nContacts:", rows.length);
  const reasons = new Map<string, number>();
  for (const r of rows) if (r.excluded) reasons.set(r.excluded, (reasons.get(r.excluded) ?? 0) + 1);
  for (const [why, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  excluded, ${why}: ${n}`);
  for (const seg of ["ecommerce", "local_service"] as const) {
    console.log(`  ${seg}: A ${count((r) => r.segment === seg && r.grade === "A")}, B ${count((r) => r.segment === seg && r.grade === "B")}, C ${count((r) => r.segment === seg && r.grade === "C")}`);
  }
  console.log(`Wrote ${path.relative(process.cwd(), OUT)}/audience.csv`);

  if (flag("import")) await importRows(rows);
}

// ---------------------------------------------------------------- import

function rawJsonFor(r: Row) {
  const c = r.contact;
  return {
    source: "hubspot",
    hubspot: { contactId: c.id, companyId: c.companyId },
    first_name: c.firstName,
    last_name: c.lastName,
    title: c.jobTitle,
    city: c.city,
    state: c.state,
    country: c.country,
    organization: {
      name: r.company?.name ?? null,
      industry: r.company?.industry ?? null,
      website_url: r.website,
      short_description: r.company?.description?.slice(0, 400) ?? null,
      estimated_num_employees: r.company?.employees ?? null,
    },
    ...(r.store ? { store: r.store } : {}),
    audience: { segment: r.segment, grade: r.grade, reasons: r.reasons, signals: r.signals },
  };
}

async function importRows(rows: Row[]) {
  const grades = new Set((option("grades") ?? "A,B").split(",").map((g) => g.trim().toUpperCase()));
  const picked = rows.filter((r) => !r.excluded && r.grade && grades.has(r.grade));
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const { default: pg } = await import("pg");
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const campaignId = option("campaign");
  if (campaignId) {
    const { rows: found } = await db.query(`select status from "Campaign" where id = $1`, [campaignId]);
    if (!found[0]) throw new Error(`Campaign ${campaignId} not found`);
    if (!["draft", "paused"].includes(found[0].status)) {
      throw new Error(`Campaign is ${found[0].status}; enroll only into a draft or paused campaign`);
    }
  }

  let inserted = 0;
  let updated = 0;
  let enrolled = 0;
  try {
    for (const r of picked) {
      const c = r.contact;
      const location = [c.city ?? r.company?.city, c.state ?? r.company?.state, c.country ?? r.company?.country].filter(Boolean).join(", ") || null;
      // Merge into an existing lead: keep what's there, add the HubSpot/audience facts.
      const { rows: res } = await db.query(
        `insert into "Lead" (id, email, "firstName", "lastName", title, company, industry, location, phone, "rawJson", "importedAt", "updatedAt")
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
         on conflict (email) do update set
           "firstName" = coalesce("Lead"."firstName", excluded."firstName"),
           "lastName"  = coalesce("Lead"."lastName", excluded."lastName"),
           title       = coalesce("Lead".title, excluded.title),
           company     = coalesce("Lead".company, excluded.company),
           industry    = coalesce("Lead".industry, excluded.industry),
           location    = coalesce("Lead".location, excluded.location),
           phone       = coalesce("Lead".phone, excluded.phone),
           "rawJson"   = "Lead"."rawJson" || excluded."rawJson",
           "updatedAt" = now()
         returning id, (xmax = 0) as inserted`,
        [
          `c${randomUUID().replace(/-/g, "").slice(0, 24)}`,
          c.email,
          c.firstName,
          c.lastName,
          c.jobTitle,
          r.company?.name ?? null,
          r.company?.industry ?? null,
          location,
          c.phone,
          JSON.stringify(rawJsonFor(r)),
        ],
      );
      if (res[0].inserted) inserted++;
      else updated++;

      if (campaignId) {
        const { rowCount } = await db.query(
          `insert into "Enrollment" (id, "campaignId", "leadId", "currentStep", status, "nextSendAt", "attemptCount", "createdAt", "updatedAt")
           values ($1, $2, $3, 0, 'active', now(), 0, now(), now())
           on conflict ("campaignId", "leadId") do nothing`,
          [`c${randomUUID().replace(/-/g, "").slice(0, 24)}`, campaignId, res[0].id],
        );
        enrolled += rowCount ?? 0;
      }
    }
  } finally {
    await db.end();
  }
  console.log(`Imported grades ${[...grades].join(",")}: ${inserted} new, ${updated} updated${campaignId ? `, ${enrolled} enrolled (campaign left as is)` : ""}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
