import { z } from "zod";

export const PRONTO_HOST = "pronto.inferaform.com";

/** Shape stored on the lead at `rawJson.speedAudit`. */
export type StoredSpeedAudit = {
  reportUrl: string;
  responseSeconds: number | null;
  channel: "sms" | "call" | "email" | null;
  testedAt: string;
};

const prontoReportSchema = z.object({
  business: z.string().nullish(),
  website: z.string().nullish(),
  testedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "testedAt is not a date"),
  responseSeconds: z.number().nonnegative().nullable(),
  firstResponseChannel: z.enum(["sms", "call", "email"]).nullable(),
  reportUrl: z.string().nullish(),
});

/**
 * Accepts a Pronto report link (`https://pronto.inferaform.com/r/{token}`, with
 * or without `.json`) and returns its canonical report URL, or null when it
 * isn't one. Only this host is ever fetched.
 */
export function parseProntoReportUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== PRONTO_HOST || url.port) return null;
  const match = url.pathname.match(/^\/r\/([A-Za-z0-9_-]+?)(?:\.json)?\/?$/);
  if (!match) return null;
  return `https://${PRONTO_HOST}/r/${match[1]}`;
}

export class SpeedAuditError extends Error {}

export async function fetchSpeedAudit(input: string): Promise<StoredSpeedAudit> {
  const reportUrl = parseProntoReportUrl(input);
  if (!reportUrl) {
    throw new SpeedAuditError(`Use a report link like https://${PRONTO_HOST}/r/abc123`);
  }

  let response: Response;
  try {
    response = await fetch(`${reportUrl}.json`, {
      headers: { accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new SpeedAuditError("Couldn't reach Pronto. Try again in a moment.");
  }
  if (response.status === 404) throw new SpeedAuditError("Pronto has no report at that link.");
  if (!response.ok) throw new SpeedAuditError(`Pronto returned ${response.status}.`);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new SpeedAuditError("Pronto didn't return JSON for that report.");
  }
  const parsed = prontoReportSchema.safeParse(body);
  if (!parsed.success) throw new SpeedAuditError("Pronto's report is missing fields we need.");

  return {
    reportUrl,
    responseSeconds: parsed.data.responseSeconds,
    channel: parsed.data.firstResponseChannel,
    testedAt: new Date(parsed.data.testedAt).toISOString(),
  };
}
