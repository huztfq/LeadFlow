import type { ApolloPerson } from "./import-leads";

const APOLLO_SEARCH_URL = "https://api.apollo.io/api/v1/mixed_people/api_search";
const APOLLO_MATCH_URL = "https://api.apollo.io/api/v1/people/match";
const APOLLO_PROFILE_URL = "https://api.apollo.io/api/v1/users/api_profile";
const MAX_PER_PAGE = 100;
const DEFAULT_PER_PAGE = 25;

export type ApolloSearchFilters = {
  q_keywords?: string;
  person_titles?: string[];
  person_locations?: string[];
  organization_industry_tag_ids?: string[];
  q_organization_industry_keywords?: string;
  /** Prefer people Apollo flags as having email */
  contact_email_status?: string[];
  page?: number;
  per_page?: number;
};

export type ApolloSearchResult = {
  people: ApolloPerson[];
  total: number;
};

type ApolloSearchResponse = {
  people?: ApolloPerson[];
  pagination?: { total_entries?: number };
};

type ApolloMatchResponse = {
  person?: ApolloPerson | null;
};

function apiKey(): string {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error("APOLLO_API_KEY is not set");
  return key;
}

function apolloHeaders(): HeadersInit {
  return {
    "x-api-key": apiKey(),
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
  };
}

function buildRequestBody(filters: ApolloSearchFilters): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (filters.q_keywords?.trim()) {
    body.q_keywords = filters.q_keywords.trim();
  }
  if (filters.person_titles?.length) {
    body.person_titles = filters.person_titles.filter((title) => title.trim().length > 0);
  }
  if (filters.person_locations?.length) {
    body.person_locations = filters.person_locations.filter((loc) => loc.trim().length > 0);
  }
  if (filters.organization_industry_tag_ids?.length) {
    body.organization_industry_tag_ids = filters.organization_industry_tag_ids;
  }
  if (filters.q_organization_industry_keywords?.trim()) {
    body.q_organization_keywords = filters.q_organization_industry_keywords.trim();
  }
  if (filters.contact_email_status?.length) {
    body.contact_email_status = filters.contact_email_status;
  }

  body.page = filters.page && filters.page > 0 ? filters.page : 1;
  const requestedPerPage = filters.per_page && filters.per_page > 0 ? filters.per_page : DEFAULT_PER_PAGE;
  body.per_page = Math.min(requestedPerPage, MAX_PER_PAGE);

  return body;
}

/** Normalize search payload fields (obfuscated last names, flags). */
export function normalizeSearchPerson(raw: ApolloPerson): ApolloPerson {
  return {
    ...raw,
    last_name: raw.last_name?.trim() || null,
    last_name_obfuscated: raw.last_name_obfuscated ?? null,
    has_email: Boolean(raw.has_email),
    has_direct_phone:
      raw.has_direct_phone === true ||
      raw.has_direct_phone === "Yes" ||
      raw.has_direct_phone === "yes",
  };
}

export async function searchPeople(filters: ApolloSearchFilters): Promise<ApolloSearchResult> {
  const response = await fetch(APOLLO_SEARCH_URL, {
    method: "POST",
    headers: apolloHeaders(),
    body: JSON.stringify(buildRequestBody(filters)),
  });

  if (!response.ok) {
    throw new Error(`Apollo search failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as ApolloSearchResponse;
  const people = (data.people ?? []).map(normalizeSearchPerson);
  const total = data.pagination?.total_entries ?? people.length;

  return { people, total };
}

/**
 * Reveal contact details for one Apollo person (uses credits when data is found).
 * Phone reveal via webhook is not used here — business email comes from match.
 */
export async function enrichPersonById(apolloId: string): Promise<ApolloPerson | null> {
  const response = await fetch(APOLLO_MATCH_URL, {
    method: "POST",
    headers: apolloHeaders(),
    body: JSON.stringify({
      id: apolloId,
      reveal_personal_emails: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Apollo enrich failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as ApolloMatchResponse;
  if (!data.person) return null;
  return normalizeSearchPerson(data.person);
}

export type EnrichBatchResult = {
  people: ApolloPerson[];
  enriched: number;
  failed: number;
  skippedNoId: number;
};

export async function enrichPeopleByIds(apolloIds: string[]): Promise<EnrichBatchResult> {
  const people: ApolloPerson[] = [];
  let enriched = 0;
  let failed = 0;
  let skippedNoId = 0;

  for (const id of apolloIds) {
    if (!id?.trim()) {
      skippedNoId += 1;
      continue;
    }
    try {
      const person = await enrichPersonById(id.trim());
      if (person) {
        people.push(person);
        enriched += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { people, enriched, failed, skippedNoId };
}

type ApolloProfileResponse = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  num_credits_remaining?: number;
  effective_num_lead_credits?: number;
  num_lead_credits_used?: number;
  effective_num_direct_dial_credits?: number;
  num_direct_dial_credits_used?: number;
  effective_num_export_credits?: number;
  num_export_credits_used?: number;
  effective_num_ai_credits?: number;
  num_ai_credits_used?: number;
  effective_num_power_up_credits?: number;
  num_power_up_credits_used?: number;
  total_unified_credits_used?: number;
};

export type ApolloCreditBucket = {
  label: string;
  used: number;
  allowance: number;
  remaining: number;
};

export type ApolloUsage = {
  accountName: string | null;
  /** Primary "remaining" number to headline in the UI (lead credits). */
  creditsRemaining: number | null;
  buckets: ApolloCreditBucket[];
};

function bucket(label: string, allowance?: number, used?: number): ApolloCreditBucket | null {
  if (typeof allowance !== "number" || typeof used !== "number") return null;
  return { label, used, allowance, remaining: Math.max(allowance - used, 0) };
}

/**
 * Apollo's "Get Current User Profile" endpoint (0 credits) exposes remaining
 * credit balances when `include_credit_usage=true` is passed. This is the
 * only credit/usage data Apollo makes available to a regular (non-master)
 * API key — there is no dedicated "usage" endpoint for standard keys.
 */
export async function getApolloUsage(): Promise<ApolloUsage> {
  const response = await fetch(`${APOLLO_PROFILE_URL}?include_credit_usage=true`, {
    method: "GET",
    headers: apolloHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Apollo usage lookup failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as ApolloProfileResponse;

  const accountName =
    [data.first_name, data.last_name].filter(Boolean).join(" ").trim() || data.email || null;

  const buckets = [
    bucket("Lead credits", data.effective_num_lead_credits, data.num_lead_credits_used),
    bucket("Direct dial credits", data.effective_num_direct_dial_credits, data.num_direct_dial_credits_used),
    bucket("Export credits", data.effective_num_export_credits, data.num_export_credits_used),
    bucket("AI credits", data.effective_num_ai_credits, data.num_ai_credits_used),
    bucket("Power-up credits", data.effective_num_power_up_credits, data.num_power_up_credits_used),
  ].filter((b): b is ApolloCreditBucket => b !== null);

  return {
    accountName,
    creditsRemaining: typeof data.num_credits_remaining === "number" ? data.num_credits_remaining : null,
    buckets,
  };
}
