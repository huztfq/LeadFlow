/**
 * What we saw on the lead's own storefront (written to `rawJson.store` by the
 * HubSpot/Shopify import scripts from the public `/products.json` feed and the
 * homepage). Only observed facts — never inferred metrics.
 */
export type StoreFacts = {
  checkedAt: string | null;
  productCount: number | null;
  soldOutProducts: number | null;
  /** One concrete example: a product and the variants that were unavailable. */
  example: { title: string; variants: string[] } | null;
  /** True when a back-in-stock / notify-me widget was detected on the store. */
  hasBackInStock: boolean | null;
};

export type PersonalizationFacts = {
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  headline: string | null;
  seniority: string | null;
  company: string | null;
  industry: string | null;
  companyDescription: string | null;
  website: string | null;
  keywords: string[];
  employeeCount: number | null;
  location: string | null;
  recentRoles: string[];
  store: StoreFacts | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringList(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, max);
}

function recentRolesFromHistory(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const roles: string[] = [];
  for (const entry of raw.slice(0, 3)) {
    const row = asRecord(entry);
    if (!row) continue;
    const title = asString(row.title) ?? asString(row.organization_name);
    const org = asString(row.organization_name);
    if (title && org && title !== org) roles.push(`${title} at ${org}`);
    else if (title) roles.push(title);
  }
  return roles;
}

function storeFactsFrom(raw: Record<string, unknown> | null): StoreFacts | null {
  const store = asRecord(raw?.store);
  if (!store) return null;
  const example = asRecord(store.example);
  const exampleTitle = asString(example?.title);
  return {
    checkedAt: asString(store.checkedAt),
    productCount: asNumber(store.productCount),
    soldOutProducts: asNumber(store.soldOutProducts),
    example: exampleTitle ? { title: exampleTitle, variants: asStringList(example?.variants, 6) } : null,
    hasBackInStock: typeof store.hasBackInStock === "boolean" ? store.hasBackInStock : null,
  };
}

/** Pulls only public Apollo facts we already store on the lead (columns + rawJson). */
export function extractPersonalizationFacts(lead: {
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  company?: string | null;
  industry?: string | null;
  location?: string | null;
  rawJson?: unknown;
}): PersonalizationFacts {
  const raw = asRecord(lead.rawJson);
  const org = asRecord(raw?.organization);

  const title = lead.title ?? asString(raw?.title);
  const company = lead.company ?? asString(org?.name);
  const industry = lead.industry ?? asString(org?.industry) ?? asString(raw?.industry);
  const location =
    lead.location ??
    ([asString(raw?.city) ?? asString(org?.city), asString(raw?.state) ?? asString(org?.state), asString(raw?.country) ?? asString(org?.country)]
      .filter(Boolean)
      .join(", ") ||
      null);

  const description = asString(org?.short_description);
  return {
    firstName: lead.firstName ?? asString(raw?.first_name),
    lastName: lead.lastName ?? asString(raw?.last_name),
    title,
    headline: asString(raw?.headline),
    seniority: asString(raw?.seniority),
    company,
    industry,
    companyDescription: description ? description.slice(0, 400) : null,
    website: asString(org?.website_url) ?? asString(org?.primary_domain),
    keywords: asStringList(org?.keywords),
    employeeCount: asNumber(org?.estimated_num_employees),
    location,
    recentRoles: recentRolesFromHistory(raw?.employment_history),
    store: storeFactsFrom(raw),
  };
}

export function hasPersonalizationFacts(facts: PersonalizationFacts): boolean {
  return Boolean(
    facts.title || facts.company || facts.industry || facts.headline || facts.companyDescription || facts.store,
  );
}

function joinVariants(variants: string[]): string {
  const clean = variants.filter((v) => v && !/^default title$/i.test(v));
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
}

/**
 * One sentence built only from what we saw on the storefront. Used instead of
 * a Claude opener whenever store facts exist, so follow-ups reference the
 * store rather than restating the lead's job title.
 */
export function storeOpener(facts: PersonalizationFacts): string {
  const store = facts.store;
  if (!store) return "";
  const where = facts.company ? `on ${facts.company}` : "on your store";
  if (store.example) {
    const variants = joinVariants(store.example.variants);
    const soldOut = variants
      ? `${store.example.title} was sold out in ${variants}`
      : `${store.example.title} was sold out`;
    const notify =
      store.hasBackInStock === false ? ", and I couldn't see a back-in-stock option on the page" : "";
    return `When I looked ${where}, ${soldOut}${notify}.`;
  }
  if (store.productCount && store.productCount > 0) {
    return `Had a look through ${facts.company ?? "your store"} — ${store.productCount} products, all in stock when I checked.`;
  }
  return "";
}

/** Deterministic one-liner when Claude is unavailable. Uses only known facts. */
export function fallbackOpener(facts: PersonalizationFacts): string {
  const bits: string[] = [];
  if (facts.title && facts.company) {
    bits.push(`${facts.title} at ${facts.company}`);
  } else if (facts.company) {
    bits.push(facts.company);
  } else if (facts.title) {
    bits.push(facts.title);
  }
  if (facts.location && bits.length > 0) bits.push(`in ${facts.location}`);
  if (bits.length === 0) return "";
  return `Noticed you're ${bits.join(" ")}.`;
}
