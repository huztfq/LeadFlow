const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

/**
 * "Sign in with Google" for the login page — identity only (no calendar
 * access), and deliberately kept separate from the Calendar page's Google
 * OAuth connection (`@/lib/calendar-google`):
 * - Different redirect URI (`GOOGLE_LOGIN_REDIRECT_URI`, e.g.
 *   `/api/auth/google/callback`) vs the calendar's `GOOGLE_REDIRECT_URI`
 *   (`/api/calendar/google/callback`). A single Google OAuth client can have
 *   multiple redirect URIs registered, so both can share the same
 *   `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` without colliding.
 * - Different, narrower scope (`openid email profile` — no
 *   `calendar.readonly`).
 * - A separate access token that's used once (to read the email) and never
 *   stored — unlike the calendar connection's stored access/refresh tokens.
 */
export function isGoogleLoginConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_LOGIN_REDIRECT_URI,
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function buildGoogleLoginAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: requireEnv("GOOGLE_LOGIN_REDIRECT_URI"),
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleLoginCode(code: string): Promise<{ access_token: string }> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: requireEnv("GOOGLE_LOGIN_REDIRECT_URI"),
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

export type GoogleIdentity = { email: string; name: string | null };

export async function fetchGoogleIdentity(accessToken: string): Promise<GoogleIdentity | null> {
  const response = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) return null;
  const data = (await response.json()) as { email?: string; name?: string };
  if (!data.email) return null;
  return { email: data.email.trim().toLowerCase(), name: data.name?.trim() || null };
}
