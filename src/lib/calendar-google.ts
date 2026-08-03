import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function stateSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET ?? process.env.APP_PASSWORD;
  if (!secret) throw new Error("APP_PASSWORD is not set");
  return secret;
}

/** Signed, time-limited CSRF token for the OAuth `state` param — this app has
 * no server-side session store, so the state is self-contained rather than
 * looked up server-side. */
export function createOAuthState(): string {
  const nonce = randomBytes(8).toString("hex");
  const payload = `${Date.now()}.${nonce}`;
  const signature = createHmac("sha256", stateSecret()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifyOAuthState(state: string | null): boolean {
  if (!state) return false;
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [timestamp, nonce, signature] = parts;
  const payload = `${timestamp}.${nonce}`;
  const expected = createHmac("sha256", stateSecret()).update(payload).digest("hex");

  try {
    const actualBuf = Buffer.from(signature, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) return false;
  } catch {
    return false;
  }

  const age = Date.now() - Number(timestamp);
  return Number.isFinite(age) && age >= 0 && age <= OAUTH_STATE_TTL_MS;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Builds the Google OAuth consent URL for read-only calendar access. `state`
 * should be an unguessable, single-use value to defend against CSRF. */
export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: requireEnv("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/calendar.readonly openid email",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export type GoogleTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

export async function exchangeGoogleCode(code: string): Promise<GoogleTokens> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: requireEnv("GOOGLE_REDIRECT_URI"),
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) {
    throw new Error(`Google token refresh failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const response = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) return null;
  const data = (await response.json()) as { email?: string };
  return data.email ?? null;
}

export type GoogleCalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date | null;
};

type RawGoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export async function listGoogleEvents(accessToken: string, opts: { timeMin: Date; maxResults?: number }) {
  const params = new URLSearchParams({
    timeMin: opts.timeMin.toISOString(),
    maxResults: String(opts.maxResults ?? 20),
    singleEvents: "true",
    orderBy: "startTime",
  });
  const response = await fetch(`${CALENDAR_EVENTS_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Google Calendar list events failed (${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as { items?: RawGoogleEvent[] };
  return (data.items ?? [])
    .filter((item) => item.status !== "cancelled")
    .map((item): GoogleCalendarEvent => ({
      id: item.id,
      title: item.summary ?? "(no title)",
      description: item.description ?? null,
      location: item.location ?? null,
      start: new Date(item.start?.dateTime ?? item.start?.date ?? Date.now()),
      end: item.end?.dateTime || item.end?.date ? new Date(item.end.dateTime ?? item.end.date!) : null,
    }));
}
