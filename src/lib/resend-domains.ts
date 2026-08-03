import { getResend } from "@/lib/resend";

export type ResendDomain = {
  id: string;
  name: string;
  status: string;
  region: string;
  createdAt: string;
  openTracking?: boolean;
  clickTracking?: boolean;
};

export type ResendDomainRecord = {
  record: string;
  name: string;
  value: string;
  type: string;
  ttl: string;
  status: string;
  priority?: number;
};

export type ResendDomainDetail = ResendDomain & {
  records: ResendDomainRecord[];
};

export type ResendDomainError = Error & {
  statusCode?: number | null;
  code?: string;
};

type RawDomain = {
  id: string;
  name: string;
  status: string;
  region: string;
  created_at: string;
  open_tracking?: boolean;
  click_tracking?: boolean;
};

type RawRecord = {
  record: string;
  name: string;
  value: string;
  type: string;
  ttl: string;
  status: string;
  priority?: number;
};

function mapDomain(raw: RawDomain): ResendDomain {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status,
    region: raw.region,
    createdAt: raw.created_at,
    openTracking: raw.open_tracking,
    clickTracking: raw.click_tracking,
  };
}

function mapRecords(records: RawRecord[] | undefined): ResendDomainRecord[] {
  return (records ?? []).map((record) => ({
    record: record.record,
    name: record.name,
    value: record.value,
    type: record.type,
    ttl: record.ttl,
    status: record.status,
    priority: record.priority,
  }));
}

function toDomainError(
  action: string,
  error: { message: string; name?: string; statusCode?: number | null },
): ResendDomainError {
  const err = new Error(`Resend ${action} failed: ${error.message}`) as ResendDomainError;
  err.statusCode = error.statusCode;
  err.code = error.name;
  return err;
}

/** All domains on the Resend account, most-recently-created first (as returned by the API). */
export async function listDomains(): Promise<ResendDomain[]> {
  const resend = getResend();
  const { data, error } = await resend.domains.list();
  if (error) throw toDomainError("list domains", error);
  return (data?.data ?? []).map(mapDomain);
}

/** Registers a new sending domain. Resend returns the DNS records to configure. */
export async function createDomain(name: string): Promise<ResendDomainDetail> {
  const resend = getResend();
  const { data, error } = await resend.domains.create({ name: name.trim() });
  if (error) throw toDomainError("create domain", error);
  if (!data) throw new Error("Resend create domain returned no data");
  return { ...mapDomain(data), records: mapRecords(data.records) };
}

/** Fetches a domain including its DNS records (for setup/verification). */
export async function getDomain(id: string): Promise<ResendDomainDetail> {
  const resend = getResend();
  const { data, error } = await resend.domains.get(id);
  if (error) throw toDomainError("get domain", error);
  if (!data) throw new Error("Domain not found");
  return { ...mapDomain(data), records: mapRecords(data.records) };
}

/**
 * Kicks off DNS verification. Resend's verify response only echoes the id, so
 * we re-fetch the domain afterward to hand back the up-to-date status/records.
 */
export async function verifyDomain(id: string): Promise<ResendDomainDetail> {
  const resend = getResend();
  const { error } = await resend.domains.verify(id);
  if (error) throw toDomainError("verify domain", error);
  return getDomain(id);
}

/** Updates open/click tracking for a domain. Re-fetches to return the full record. */
export async function updateDomain(
  id: string,
  options: { openTracking?: boolean; clickTracking?: boolean },
): Promise<ResendDomainDetail> {
  const resend = getResend();
  const { error } = await resend.domains.update({
    id,
    openTracking: options.openTracking,
    clickTracking: options.clickTracking,
  });
  if (error) throw toDomainError("update domain", error);
  return getDomain(id);
}

export async function removeDomain(id: string): Promise<{ id: string; deleted: boolean }> {
  const resend = getResend();
  const { data, error } = await resend.domains.remove(id);
  if (error) throw toDomainError("remove domain", error);
  if (!data) throw new Error("Resend remove domain returned no data");
  return { id: data.id, deleted: data.deleted };
}
