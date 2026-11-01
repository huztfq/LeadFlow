/**
 * Picks Inferaform's target audience out of HubSpot contacts: who fits
 * (segment), who to leave out (exclusions), what their website shows
 * (signals), and how good a fit they are (A/B/C grade).
 *
 * Pure functions only — no network, no imports — so the CLI
 * (scripts/hubspot-audience.ts, run with plain `node`) and vitest share it.
 */

export type Segment = "ecommerce" | "local_service";
export type Grade = "A" | "B" | "C";

export type HubSpotContact = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lifecycleStage: string | null;
  optedOut: boolean;
  hardBounced: boolean;
  lastContactedAt: string | null;
  companyId: string | null;
};

export type HubSpotCompany = {
  id: string;
  name: string | null;
  domain: string | null;
  website: string | null;
  industry: string | null;
  description: string | null;
  employees: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lifecycleStage: string | null;
};

/** What we saw on their own website. Null = couldn't tell (site down, blocked). */
export type SiteSignals = {
  checkedAt: string;
  reachable: boolean;
  shopify: boolean;
  metaPixel: boolean;
  googleAds: boolean;
  tiktokPixel: boolean;
  emailFlowsTool: string | null;
  smsTool: string | null;
  backInStock: boolean;
  chatWidget: string | null;
  leadForm: boolean;
  phoneOnSite: boolean;
  bookingTool: string | null;
};

/** Same shape as `rawJson.store` read by apollo-context.ts. */
export type StoreFacts = {
  checkedAt: string | null;
  productCount: number | null;
  soldOutProducts: number | null;
  example: { title: string; variants: string[] } | null;
  hasBackInStock: boolean | null;
};

// ---------------------------------------------------------------- segments

const ECOM_INDUSTRY =
  /retail|apparel|fashion|cosmetic|beauty|jewel|consumer[_ ]goods|luxury|sporting[_ ]goods|health[_ ]wellness|food[_ ]production|food[_ ]beverages|wine|furniture|e-?commerce|online[_ ]retail|supplements?|skincare/i;

const LOCAL_SERVICE =
  /water[ _-]?(treatment|softener|filtration|purification)|hvac|heating|air[ _-]?condition|plumb|roof|solar|pest|landscap|lawn|pool|garage[ _-]?door|electric(al|ian)|remodel|home[ _-]?improvement|construction|cleaning|restoration|med[ _-]?spa|dental|dentist|chiropract|orthodont|veterinar|auto[ _-]?repair|moving|movers|flooring|window|gutter|fenc|paving|concrete|septic|well[ _-]?drilling|insulation|siding/i;

/** Agencies and competitors: never pitch them. */
const AGENCY = /marketing[_ ]and[_ ]advertising|advertising|public[_ ]relations|\bagency\b|\bmarketing\b|media buying|lead gen/i;

export function classifySegment(company: HubSpotCompany | null, signals: SiteSignals | null): Segment | null {
  const text = [company?.industry, company?.name, company?.description].filter(Boolean).join(" ");
  // Industry and name only: plenty of brands mention "marketing" in their description.
  if (AGENCY.test([company?.industry, company?.name].filter(Boolean).join(" "))) return null;
  if (LOCAL_SERVICE.test(text)) return "local_service";
  if (signals?.shopify || ECOM_INDUSTRY.test(text)) return "ecommerce";
  return null;
}

// ---------------------------------------------------------------- people

const DECISION_MAKER =
  /\b(founder|co-?founder|owner|co-?owner|ceo|chief executive|president|principal|partner|managing director|general manager|\bgm\b|director of (marketing|growth|e-?commerce|digital)|head of (marketing|growth|e-?commerce|digital|dtc)|(marketing|growth|e-?commerce|digital) (director|manager|lead)|vp|vice president|cmo|coo)\b/i;
const OFFICE_ROLE = /\b(office manager|operations manager)\b/i;

export function isDecisionMaker(title: string | null, segment: Segment): boolean {
  if (!title) return false;
  if (DECISION_MAKER.test(title)) return true;
  return segment === "local_service" && OFFICE_ROLE.test(title);
}

const GENERIC_INBOX =
  /^(info|hello|hi|support|help|sales|admin|contact|team|orders?|office|service|customerservice|care|enquiries|inquiries|mail|shop|store|marketing|billing|accounts?|noreply|no-reply)@/i;

export function isGenericInbox(email: string): boolean {
  return GENERIC_INBOX.test(email);
}

const NORTH_AMERICA = /^(us|usa|u\.s\.a?\.?|united states( of america)?|america|ca|can|canada)$/i;

export function inNorthAmerica(...countries: (string | null)[]): boolean | null {
  const known = countries.map((c) => c?.trim()).filter((c): c is string => Boolean(c));
  if (known.length === 0) return null;
  return known.some((c) => NORTH_AMERICA.test(c));
}

const CUSTOMER_STAGES = new Set(["customer", "evangelist"]);
const DAY = 86_400_000;

export type ExclusionOptions = {
  now?: Date;
  /** Skip anyone contacted (by anyone, in HubSpot) more recently than this. */
  recentContactDays?: number;
  minEmployees?: number;
  maxEmployees?: number;
};

/** Why this contact must not be emailed, or null when they're fine. */
export function exclusionReason(
  contact: HubSpotContact,
  company: HubSpotCompany | null,
  opts: ExclusionOptions = {},
): string | null {
  const now = (opts.now ?? new Date()).getTime();
  const recentDays = opts.recentContactDays ?? 30;
  const minEmp = opts.minEmployees ?? 2;
  const maxEmp = opts.maxEmployees ?? 50;

  if (!contact.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email)) return "no email";
  if (contact.optedOut) return "unsubscribed";
  if (contact.hardBounced) return "bounced";
  const stage = (contact.lifecycleStage ?? company?.lifecycleStage ?? "").toLowerCase();
  if (CUSTOMER_STAGES.has(stage) || CUSTOMER_STAGES.has((company?.lifecycleStage ?? "").toLowerCase())) {
    return "current customer";
  }
  if (contact.lastContactedAt) {
    const at = Date.parse(contact.lastContactedAt);
    if (Number.isFinite(at) && now - at < recentDays * DAY) return `contacted in last ${recentDays} days`;
  }
  if (inNorthAmerica(contact.country, company?.country ?? null) === false) return "outside US/Canada";
  const employees = company?.employees;
  if (employees != null && (employees < minEmp || employees > maxEmp)) return `${employees} employees`;
  return null;
}

/**
 * At most `max` people per company: decision makers first; a generic inbox
 * (hello@) only when the company has no named decision maker.
 */
export function pickContacts<T extends { contact: HubSpotContact }>(rows: T[], segment: Segment, max = 2): T[] {
  const named = rows.filter((r) => !isGenericInbox(r.contact.email ?? "") && isDecisionMaker(r.contact.jobTitle, segment));
  if (named.length > 0) return named.slice(0, max);
  const other = rows.filter((r) => !isGenericInbox(r.contact.email ?? ""));
  if (other.length > 0) return other.slice(0, 1);
  return rows.slice(0, 1);
}

// ---------------------------------------------------------------- website

function firstMatch(html: string, tools: [string, RegExp][]): string | null {
  for (const [name, re] of tools) if (re.test(html)) return name;
  return null;
}

const EMAIL_TOOLS: [string, RegExp][] = [
  ["Klaviyo", /klaviyo\.com|klaviyo_/i],
  ["Omnisend", /omnisend/i],
  ["Mailchimp", /chimpstatic\.com|list-manage\.com|mailchimp/i],
  ["Drip", /getdrip\.com/i],
];
const SMS_TOOLS: [string, RegExp][] = [
  ["Postscript", /postscript\.io|sdk\.postscript/i],
  ["Attentive", /attn\.tv|attentivemobile/i],
  ["SMSBump/Yotpo SMS", /smsbump|yotpo.*sms/i],
];
const CHAT_TOOLS: [string, RegExp][] = [
  ["Podium", /podium\.com/i],
  ["Birdeye", /birdeye\.com/i],
  ["Gorgias", /gorgias/i],
  ["Tidio", /tidio/i],
  ["Intercom", /intercom/i],
  ["Drift", /drift\.com/i],
  ["LiveChat", /livechatinc/i],
  ["Zendesk", /zdassets|zopim/i],
];
const BOOKING_TOOLS: [string, RegExp][] = [
  ["Calendly", /calendly\.com/i],
  ["Housecall Pro", /housecallpro/i],
  ["ServiceTitan", /servicetitan/i],
  ["Jobber", /getjobber|jobber\.com/i],
  ["Acuity", /acuityscheduling/i],
];
const BACK_IN_STOCK =
  /back[ -]?in[ -]?stock|notify[ -]?me|restock[ -]?rocket|appikon|swym|klaviyo.*BackInStock|notify-when-available|email me when available/i;

/** Reads one homepage's HTML. Facts only — nothing inferred. */
export function detectSiteSignals(html: string, checkedAt = new Date().toISOString()): SiteSignals {
  const forms = html.match(/<form[\s\S]*?<\/form>/gi) ?? [];
  const leadForm = forms.some(
    (f) => /type=["']?tel|name=["'][^"']*phone|<textarea/i.test(f) && !/search/i.test(f.slice(0, 200)),
  );
  return {
    checkedAt,
    reachable: true,
    shopify: /cdn\.shopify\.com|Shopify\.theme|myshopify\.com/i.test(html),
    // Classic snippet, or Shopify's web-pixel config for the Facebook & Instagram app.
    metaPixel: /connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(\s*['"]init|facebook_pixel/i.test(html),
    googleAds: /\bAW-\d{6,}|googleads\.g\.doubleclick\.net|googleadservices\.com|conversion_label/i.test(html),
    tiktokPixel: /analytics\.tiktok\.com|tiktok_pixel|ttq\.load/i.test(html),
    emailFlowsTool: firstMatch(html, EMAIL_TOOLS),
    smsTool: firstMatch(html, SMS_TOOLS),
    backInStock: BACK_IN_STOCK.test(html),
    chatWidget: firstMatch(html, CHAT_TOOLS),
    leadForm,
    phoneOnSite: /href=["']tel:/i.test(html),
    bookingTool: firstMatch(html, BOOKING_TOOLS),
  };
}

export function unreachableSignals(checkedAt = new Date().toISOString()): SiteSignals {
  return {
    checkedAt,
    reachable: false,
    shopify: false,
    metaPixel: false,
    googleAds: false,
    tiktokPixel: false,
    emailFlowsTool: null,
    smsTool: null,
    backInStock: false,
    chatWidget: null,
    leadForm: false,
    phoneOnSite: false,
    bookingTool: null,
  };
}

type ShopifyProduct = {
  title?: string;
  variants?: { title?: string; available?: boolean }[];
};

/** Store facts from a Shopify `/products.json` response. */
export function storeFactsFromProducts(
  products: ShopifyProduct[],
  hasBackInStock: boolean,
  checkedAt = new Date().toISOString(),
): StoreFacts {
  let soldOut = 0;
  let example: StoreFacts["example"] = null;
  for (const p of products) {
    const variants = p.variants ?? [];
    const unavailable = variants.filter((v) => v.available === false);
    if (variants.length > 0 && unavailable.length === variants.length) soldOut += 1;
    // Best example: a product with some sizes sold out but not all (still on sale).
    if (!example && p.title && unavailable.length > 0 && unavailable.length < variants.length) {
      example = {
        title: p.title,
        variants: unavailable
          .map((v) => v.title ?? "")
          .filter((t) => t && t !== "Default Title")
          .slice(0, 6),
      };
    }
  }
  if (!example) {
    const fully = products.find((p) => p.title && (p.variants ?? []).length > 0 && p.variants!.every((v) => v.available === false));
    if (fully?.title) example = { title: fully.title, variants: [] };
  }
  return { checkedAt, productCount: products.length, soldOutProducts: soldOut, example, hasBackInStock };
}

// ---------------------------------------------------------------- scoring

export type Score = { grade: Grade; reasons: string[] };

/**
 * A = already pays for ads AND has a follow-up gap we fix.
 * B = one of the two.  C = neither, or the site couldn't be checked.
 */
export function scoreAudience(segment: Segment, signals: SiteSignals, store: StoreFacts | null): Score {
  if (!signals.reachable) return { grade: "C", reasons: ["website not reachable"] };
  const reasons: string[] = [];
  const ads = signals.metaPixel || signals.googleAds || signals.tiktokPixel;
  if (signals.metaPixel) reasons.push("Meta pixel on site");
  if (signals.googleAds) reasons.push("Google Ads tag on site");
  if (signals.tiktokPixel) reasons.push("TikTok pixel on site");

  const gaps: string[] = [];
  if (segment === "ecommerce") {
    if (!signals.smsTool) gaps.push("no SMS follow-up tool");
    if (!signals.emailFlowsTool) gaps.push("no email flows tool");
    if (store?.example && !signals.backInStock) gaps.push("sold-out items, no back-in-stock option");
    const tooSmall = store?.productCount != null && store.productCount < 10;
    if (tooSmall) reasons.push(`only ${store!.productCount} products`);
    reasons.push(...gaps);
    if (ads && gaps.length > 0 && !tooSmall) return { grade: "A", reasons };
    if ((ads || gaps.length > 0) && !tooSmall) return { grade: "B", reasons };
    return { grade: "C", reasons };
  }

  // Local service: they need leads coming in, and nobody answering in seconds.
  const capturesLeads = signals.leadForm || signals.phoneOnSite;
  if (capturesLeads) reasons.push(signals.leadForm ? "lead form on site" : "phone number on site");
  if (!signals.chatWidget && !signals.bookingTool) gaps.push("no instant reply (chat/text/booking) on site");
  reasons.push(...gaps);
  if (ads && capturesLeads && gaps.length > 0) return { grade: "A", reasons };
  if ((ads || capturesLeads) && gaps.length > 0) return { grade: "B", reasons };
  return { grade: "C", reasons };
}

/** Normalised https origin for a company, or null. */
export function siteUrl(company: HubSpotCompany | null): string | null {
  const raw = company?.website?.trim() || company?.domain?.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!url.hostname.includes(".")) return null;
    return `https://${url.hostname}`;
  } catch {
    return null;
  }
}
