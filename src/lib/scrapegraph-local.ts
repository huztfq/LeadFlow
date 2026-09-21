import type { ApolloPerson } from "@/lib/import-leads";

const DEFAULT_SIDECAR = "http://127.0.0.1:8765";

export function isLocalScrapeAllowed(): boolean {
  return process.env.NODE_ENV !== "production";
}

export type ScrapegraphHealth = {
  sidecarUp: boolean;
  llm: string | null;
  model: string | null;
  sidecarUrl: string;
};

export type ScrapegraphPerson = {
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  email?: string | null;
  company?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  linkedin?: string | null;
};

export type ScrapegraphResult = {
  source: string;
  company: string | null;
  people: ApolloPerson[];
};

function sidecarUrl(): string {
  return (process.env.SCRAPEGRAPH_URL ?? DEFAULT_SIDECAR).replace(/\/$/, "");
}

export async function getScrapegraphHealth(): Promise<ScrapegraphHealth> {
  const url = sidecarUrl();
  try {
    const response = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) {
      return { sidecarUp: false, llm: null, model: null, sidecarUrl: url };
    }
    const data = (await response.json()) as { llm?: string; model?: string };
    return {
      sidecarUp: true,
      llm: data.llm ?? null,
      model: data.model ?? null,
      sidecarUrl: url,
    };
  } catch {
    return { sidecarUp: false, llm: null, model: null, sidecarUrl: url };
  }
}

function toPerson(raw: ScrapegraphPerson, index: number, fallbackCompany: string | null): ApolloPerson {
  const email = raw.email?.trim().toLowerCase() || null;
  const company = raw.company?.trim() || fallbackCompany;
  return {
    id: email ? `scrape:${email}` : `scrape:${index}`,
    email,
    first_name: raw.first_name ?? null,
    last_name: raw.last_name ?? null,
    title: raw.title ?? null,
    organization: company ? { name: company } : null,
    city: raw.city ?? null,
    state: raw.state ?? null,
    country: raw.country ?? null,
    phone_numbers: raw.phone ? [{ raw_number: raw.phone }] : null,
    has_email: Boolean(email),
    has_direct_phone: Boolean(raw.phone),
  };
}

export async function runLocalScrape(input: { url: string; prompt?: string }): Promise<ScrapegraphResult> {
  const url = sidecarUrl();
  const response = await fetch(`${url}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: input.url, prompt: input.prompt }),
    signal: AbortSignal.timeout(110_000),
  });
  const data = (await response.json()) as {
    error?: string;
    source?: string;
    company?: string | null;
    people?: ScrapegraphPerson[];
  };
  if (!response.ok) {
    throw new Error(data.error ?? `ScrapeGraph sidecar failed (${response.status})`);
  }
  const company = data.company ?? null;
  return {
    source: data.source ?? input.url,
    company,
    people: (data.people ?? []).map((person, index) => toPerson(person, index, company)),
  };
}
