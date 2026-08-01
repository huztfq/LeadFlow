export type ApolloPerson = {
  id?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  organization?: {
    name?: string | null;
    industry?: string | null;
  } | null;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  phone_numbers?: { raw_number?: string | null; sanitized_number?: string | null }[] | null;
  sanitized_phone?: string | null;
};

export type ImportCandidate = {
  apolloId?: string | null;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  company?: string | null;
  industry?: string | null;
  location?: string | null;
  phone?: string | null;
  rawJson: unknown;
};

export type ImportSummary = {
  imported: number;
  updated: number;
  skippedNoEmail: number;
  failed: number;
};

export type StoredLead = {
  id: string;
  apolloId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  company: string | null;
  industry: string | null;
  location: string | null;
  phone: string | null;
  rawJson: unknown;
};

export type ImportDb = {
  findByEmail(email: string): Promise<StoredLead | null>;
  findByApolloId(apolloId: string): Promise<StoredLead | null>;
  create(data: ImportCandidate): Promise<StoredLead>;
  update(id: string, data: ImportCandidate): Promise<StoredLead>;
};

function formatLocation(person: ApolloPerson): string | null {
  const parts = [person.city, person.state, person.country].filter(
    (part): part is string => Boolean(part?.trim()),
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

function extractPhone(person: ApolloPerson): string | null {
  const fromList = person.phone_numbers?.[0]?.raw_number?.trim();
  if (fromList) return fromList;
  const sanitized = person.sanitized_phone?.trim();
  return sanitized || null;
}

export function normalizeApolloPerson(person: ApolloPerson): ImportCandidate | null {
  const email = person.email?.trim().toLowerCase();
  if (!email) return null;

  return {
    apolloId: person.id ?? null,
    email,
    firstName: person.first_name ?? null,
    lastName: person.last_name ?? null,
    title: person.title ?? null,
    company: person.organization?.name ?? null,
    industry: person.organization?.industry ?? person.industry ?? null,
    location: formatLocation(person),
    phone: extractPhone(person),
    rawJson: person,
  };
}

export async function importCandidates(
  candidates: ImportCandidate[],
  db: ImportDb,
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    imported: 0,
    updated: 0,
    skippedNoEmail: 0,
    failed: 0,
  };

  for (const candidate of candidates) {
    try {
      let existing = await db.findByEmail(candidate.email);
      if (!existing && candidate.apolloId) {
        existing = await db.findByApolloId(candidate.apolloId);
      }

      if (existing) {
        await db.update(existing.id, candidate);
        summary.updated += 1;
      } else {
        await db.create(candidate);
        summary.imported += 1;
      }
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}
