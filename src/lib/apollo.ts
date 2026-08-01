import type { ApolloPerson } from "./import-leads";

const APOLLO_SEARCH_URL = "https://api.apollo.io/api/v1/mixed_people/api_search";
const MAX_PER_PAGE = 100;
const DEFAULT_PER_PAGE = 25;

export type ApolloSearchFilters = {
  q_keywords?: string;
  person_titles?: string[];
  person_locations?: string[];
  organization_industry_tag_ids?: string[];
  q_organization_industry_keywords?: string;
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

  body.page = filters.page && filters.page > 0 ? filters.page : 1;
  const requestedPerPage = filters.per_page && filters.per_page > 0 ? filters.per_page : DEFAULT_PER_PAGE;
  body.per_page = Math.min(requestedPerPage, MAX_PER_PAGE);

  return body;
}

export async function searchPeople(filters: ApolloSearchFilters): Promise<ApolloSearchResult> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error("APOLLO_API_KEY is not set");
  }

  const response = await fetch(APOLLO_SEARCH_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(buildRequestBody(filters)),
  });

  if (!response.ok) {
    throw new Error(`Apollo search failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as ApolloSearchResponse;
  const people = data.people ?? [];
  const total = data.pagination?.total_entries ?? people.length;

  return { people, total };
}
