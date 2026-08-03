export type IcsEvent = {
  title: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date | null;
};

function unfold(text: string): string {
  // RFC 5545 line folding: a continuation line starts with a single space/tab.
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/** Parses a DTSTART/DTEND value + its params into a Date. Handles the common
 * forms: `Z`-suffixed UTC, floating local time, and `VALUE=DATE` all-day
 * values. Ignores TZID (treated as local time / best-effort). */
function parseIcsDate(value: string): Date | null {
  const trimmed = value.trim();

  // All-day: YYYYMMDD
  if (/^\d{8}$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4));
    const month = Number(trimmed.slice(4, 6)) - 1;
    const day = Number(trimmed.slice(6, 8));
    return new Date(year, month, day);
  }

  // YYYYMMDDTHHMMSS(Z)?
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(trimmed);
  if (!match) return null;
  const [, y, mo, d, h, mi, s, zulu] = match;
  if (zulu) {
    return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
  }
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
}

/**
 * Minimal RFC 5545 (iCalendar) VEVENT parser: enough to read a Google
 * Calendar "secret address in iCal format" or similar export/feed and show
 * upcoming events. Not a full parser — doesn't expand RRULE recurrence,
 * doesn't resolve named timezones beyond UTC/floating. Pure function, no I/O.
 */
export function parseIcsEvents(icsText: string): IcsEvent[] {
  const unfolded = unfold(icsText);
  const lines = unfolded.split("\n");

  const events: IcsEvent[] = [];
  let inEvent = false;
  let current: { summary?: string; description?: string; location?: string; start?: Date; end?: Date } = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (inEvent && current.summary && current.start) {
        events.push({
          title: current.summary,
          description: current.description ?? null,
          location: current.location ?? null,
          start: current.start,
          end: current.end ?? null,
        });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const rawKey = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 1);
    const key = rawKey.split(";")[0].toUpperCase();

    switch (key) {
      case "SUMMARY":
        current.summary = unescapeText(value);
        break;
      case "DESCRIPTION":
        current.description = unescapeText(value);
        break;
      case "LOCATION":
        current.location = unescapeText(value);
        break;
      case "DTSTART": {
        const parsed = parseIcsDate(value);
        if (parsed) current.start = parsed;
        break;
      }
      case "DTEND": {
        const parsed = parseIcsDate(value);
        if (parsed) current.end = parsed;
        break;
      }
      default:
        break;
    }
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export async function fetchIcsEvents(url: string): Promise<IcsEvent[]> {
  const response = await fetch(url, { headers: { Accept: "text/calendar, text/plain" } });
  if (!response.ok) {
    throw new Error(`Failed to fetch calendar feed (${response.status})`);
  }
  const text = await response.text();
  return parseIcsEvents(text);
}
