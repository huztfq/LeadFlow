/**
 * Recipient-local send window for cold outreach.
 *
 * We only know a lead's location as free text ("Toronto, Canada",
 * "Riverside, Missouri, United States", "New South Wales"), so the UTC offset
 * is a best-effort match on that text with an approximate DST rule. The window
 * is wide (08:00–16:00, Mon–Fri) so an hour of error is harmless; the point is
 * to stop first-touch emails landing at 22:00 on a Friday.
 */

export type SendWindow = {
  /** Local hour (0–23) the window opens. */
  startHour: number;
  /** Local hour (0–23) the window closes (exclusive). */
  endHour: number;
  /** Local weekdays allowed; 0 = Sunday … 6 = Saturday. */
  days: number[];
};

export const DEFAULT_SEND_WINDOW: SendWindow = { startHour: 8, endHour: 16, days: [1, 2, 3, 4, 5] };

/** Offset used when the location text matches nothing (US Eastern, the most common lead market). */
const FALLBACK_OFFSET_HOURS = -5;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function nthSundayUtc(year: number, month: number, n: number): number {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (7 - first.getUTCDay()) % 7;
  return Date.UTC(year, month, 1 + offset + (n - 1) * 7);
}

function lastSundayUtc(year: number, month: number): number {
  const last = new Date(Date.UTC(year, month + 1, 0));
  return Date.UTC(year, month, last.getUTCDate() - last.getUTCDay());
}

/** US/Canada: second Sunday in March → first Sunday in November. */
function isNorthAmericaDst(date: Date): boolean {
  const y = date.getUTCFullYear();
  const t = date.getTime();
  return t >= nthSundayUtc(y, 2, 2) + 7 * HOUR_MS && t < nthSundayUtc(y, 10, 1) + 6 * HOUR_MS;
}

/** UK/EU: last Sunday in March → last Sunday in October. */
function isEuropeDst(date: Date): boolean {
  const y = date.getUTCFullYear();
  const t = date.getTime();
  return t >= lastSundayUtc(y, 2) + HOUR_MS && t < lastSundayUtc(y, 9) + HOUR_MS;
}

/** AU south-east: first Sunday in October → first Sunday in April. */
function isAustraliaDst(date: Date): boolean {
  const y = date.getUTCFullYear();
  const t = date.getTime();
  return t >= nthSundayUtc(y, 9, 1) - 8 * HOUR_MS || t < nthSundayUtc(y, 3, 1) - 8 * HOUR_MS;
}

/** NZ: last Sunday in September → first Sunday in April. */
function isNewZealandDst(date: Date): boolean {
  const y = date.getUTCFullYear();
  const t = date.getTime();
  return t >= lastSundayUtc(y, 8) - 10 * HOUR_MS || t < nthSundayUtc(y, 3, 1) - 10 * HOUR_MS;
}

type Rule = { pattern: RegExp; offset: (date: Date) => number };

// Most specific first: states/provinces/cities, then countries.
const RULES: Rule[] = [
  // Australia
  { pattern: /\b(western australia|perth)\b/i, offset: () => 8 },
  { pattern: /\b(northern territory|darwin)\b/i, offset: () => 9.5 },
  { pattern: /\b(south australia|adelaide)\b/i, offset: (d) => (isAustraliaDst(d) ? 10.5 : 9.5) },
  { pattern: /\b(queensland|brisbane|gold coast|sunshine coast|cairns|townsville)\b/i, offset: () => 10 },
  { pattern: /\b(new south wales|victoria|tasmania|australian capital territory|sydney|melbourne|canberra|hobart|newcastle|wollongong|geelong)\b/i, offset: (d) => (isAustraliaDst(d) ? 11 : 10) },
  { pattern: /\b(australia|\bAU\b)\b/i, offset: (d) => (isAustraliaDst(d) ? 11 : 10) },
  // New Zealand
  { pattern: /\b(new zealand|auckland|wellington|christchurch|\bNZ\b)\b/i, offset: (d) => (isNewZealandDst(d) ? 13 : 12) },
  // Canada
  { pattern: /\b(british columbia|vancouver|victoria, canada|yukon)\b/i, offset: (d) => (isNorthAmericaDst(d) ? -7 : -8) },
  { pattern: /\b(alberta|calgary|edmonton)\b/i, offset: (d) => (isNorthAmericaDst(d) ? -6 : -7) },
  { pattern: /\b(saskatchewan|regina|saskatoon)\b/i, offset: () => -6 },
  { pattern: /\b(manitoba|winnipeg)\b/i, offset: (d) => (isNorthAmericaDst(d) ? -5 : -6) },
  { pattern: /\b(nova scotia|new brunswick|prince edward island|halifax|moncton)\b/i, offset: (d) => (isNorthAmericaDst(d) ? -3 : -4) },
  { pattern: /\b(newfoundland|st\.? john's)\b/i, offset: (d) => (isNorthAmericaDst(d) ? -2.5 : -3.5) },
  { pattern: /\b(ontario|quebec|toronto|ottawa|montreal|canada|\bCA\b)\b/i, offset: (d) => (isNorthAmericaDst(d) ? -4 : -5) },
  // United States
  { pattern: /\b(hawaii)\b/i, offset: () => -10 },
  { pattern: /\b(alaska)\b/i, offset: (d) => (isNorthAmericaDst(d) ? -8 : -9) },
  { pattern: /\b(california|washington|oregon|nevada|los angeles|san francisco|seattle|portland|san diego)\b/i, offset: (d) => (isNorthAmericaDst(d) ? -7 : -8) },
  { pattern: /\b(arizona|phoenix)\b/i, offset: () => -7 },
  { pattern: /\b(colorado|utah|new mexico|idaho|montana|wyoming|denver|salt lake city)\b/i, offset: (d) => (isNorthAmericaDst(d) ? -6 : -7) },
  { pattern: /\b(texas|illinois|minnesota|wisconsin|iowa|missouri|arkansas|louisiana|oklahoma|kansas|nebraska|north dakota|south dakota|alabama|mississippi|tennessee|chicago|dallas|houston|austin|nashville|minneapolis)\b/i, offset: (d) => (isNorthAmericaDst(d) ? -5 : -6) },
  { pattern: /\b(united states|\bUSA?\b|new york|florida|georgia|north carolina|south carolina|virginia|pennsylvania|ohio|michigan|indiana|kentucky|massachusetts|new jersey|connecticut|maryland|maine|vermont|new hampshire|rhode island|delaware|west virginia|miami|atlanta|boston|philadelphia|washington, d\.?c\.?)\b/i, offset: (d) => (isNorthAmericaDst(d) ? -4 : -5) },
  // UK / Ireland / Europe
  { pattern: /\b(united kingdom|england|scotland|wales|northern ireland|london|manchester|birmingham|edinburgh|glasgow|ireland|dublin|portugal|lisbon|\bUK\b|\bGB\b)\b/i, offset: (d) => (isEuropeDst(d) ? 1 : 0) },
  { pattern: /\b(germany|france|spain|italy|netherlands|belgium|austria|switzerland|sweden|norway|denmark|poland|czech|berlin|paris|madrid|milan|amsterdam|stockholm|copenhagen)\b/i, offset: (d) => (isEuropeDst(d) ? 2 : 1) },
  // Middle East / South Asia / East Asia
  { pattern: /\b(united arab emirates|dubai|abu dhabi|\bUAE\b)\b/i, offset: () => 4 },
  { pattern: /\b(pakistan|islamabad|karachi|lahore)\b/i, offset: () => 5 },
  { pattern: /\b(india|mumbai|bangalore|bengaluru|delhi|hyderabad|chennai|pune)\b/i, offset: () => 5.5 },
  { pattern: /\b(singapore|hong kong|philippines|manila|malaysia|kuala lumpur)\b/i, offset: () => 8 },
  { pattern: /\b(japan|tokyo|south korea|seoul)\b/i, offset: () => 9 },
  // South Africa
  { pattern: /\b(south africa|cape town|johannesburg)\b/i, offset: () => 2 },
];

/** Best-effort UTC offset (hours) for a free-text location at the given instant. */
export function utcOffsetHoursFor(location: string | null | undefined, at: Date): number {
  if (!location) return FALLBACK_OFFSET_HOURS;
  for (const rule of RULES) {
    if (rule.pattern.test(location)) return rule.offset(at);
  }
  return FALLBACK_OFFSET_HOURS;
}

function localParts(at: Date, offsetHours: number) {
  const shifted = new Date(at.getTime() + offsetHours * HOUR_MS);
  return {
    day: shifted.getUTCDay(),
    hour: shifted.getUTCHours() + shifted.getUTCMinutes() / 60,
    midnightUtcMs: Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - offsetHours * HOUR_MS,
  };
}

export function isInSendWindow(
  at: Date,
  location: string | null | undefined,
  window: SendWindow = DEFAULT_SEND_WINDOW,
): boolean {
  const { day, hour } = localParts(at, utcOffsetHoursFor(location, at));
  return window.days.includes(day) && hour >= window.startHour && hour < window.endHour;
}

/**
 * `at` itself when inside the window; otherwise the next window opening in the
 * recipient's local time, as a UTC instant.
 */
export function nextSendWindowStart(
  at: Date,
  location: string | null | undefined,
  window: SendWindow = DEFAULT_SEND_WINDOW,
): Date {
  if (isInSendWindow(at, location, window)) return at;
  const offset = utcOffsetHoursFor(location, at);
  const { day, hour, midnightUtcMs } = localParts(at, offset);

  // Today still qualifies if the window hasn't opened yet.
  if (window.days.includes(day) && hour < window.startHour) {
    return new Date(midnightUtcMs + window.startHour * HOUR_MS);
  }
  for (let ahead = 1; ahead <= 7; ahead++) {
    const nextDay = (day + ahead) % 7;
    if (window.days.includes(nextDay)) {
      return new Date(midnightUtcMs + ahead * DAY_MS + window.startHour * HOUR_MS);
    }
  }
  return at;
}

/**
 * Parses CRON_SEND_WINDOW: "8-16" (hours, Mon–Fri), "8-16:1-5" (hours:days),
 * or "off" to disable. Anything unparseable falls back to the default window.
 */
export function sendWindowFromEnv(value: string | undefined): SendWindow | null {
  if (!value) return DEFAULT_SEND_WINDOW;
  if (/^(off|none|0)$/i.test(value.trim())) return null;
  const match = value.trim().match(/^(\d{1,2})-(\d{1,2})(?::(\d)-(\d))?$/);
  if (!match) return DEFAULT_SEND_WINDOW;
  const startHour = Number(match[1]);
  const endHour = Number(match[2]);
  if (startHour >= endHour || endHour > 24) return DEFAULT_SEND_WINDOW;
  let days = DEFAULT_SEND_WINDOW.days;
  if (match[3] && match[4]) {
    const from = Number(match[3]);
    const to = Number(match[4]);
    if (from <= to && to <= 6) days = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }
  return { startHour, endHour, days };
}
