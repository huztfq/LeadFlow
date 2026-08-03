import { describe, expect, it } from "vitest";
import { parseIcsEvents } from "./ical";

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:1@example.com
DTSTAMP:20260101T000000Z
DTSTART:20260815T140000Z
DTEND:20260815T143000Z
SUMMARY:Intro call with Acme
DESCRIPTION:Discuss pricing\\nand next steps
LOCATION:Google Meet
END:VEVENT
BEGIN:VEVENT
UID:2@example.com
DTSTAMP:20260101T000000Z
DTSTART;VALUE=DATE:20260901
SUMMARY:Company offsite
END:VEVENT
BEGIN:VEVENT
UID:3@example.com
DTSTAMP:20260101T000000Z
DTSTART:20260601T090000
DTEND:20260601T100000
SUMMARY:Long summary that
 wraps onto a folded continuation line
END:VEVENT
END:VCALENDAR`;

describe("parseIcsEvents", () => {
  it("parses UTC events with description and location", () => {
    const events = parseIcsEvents(SAMPLE_ICS);
    const intro = events.find((e) => e.title === "Intro call with Acme");
    expect(intro).toBeDefined();
    expect(intro?.start.toISOString()).toBe("2026-08-15T14:00:00.000Z");
    expect(intro?.end?.toISOString()).toBe("2026-08-15T14:30:00.000Z");
    expect(intro?.description).toBe("Discuss pricing\nand next steps");
    expect(intro?.location).toBe("Google Meet");
  });

  it("parses all-day (VALUE=DATE) events", () => {
    const events = parseIcsEvents(SAMPLE_ICS);
    const offsite = events.find((e) => e.title === "Company offsite");
    expect(offsite).toBeDefined();
    expect(offsite?.start.getFullYear()).toBe(2026);
    expect(offsite?.start.getMonth()).toBe(8); // September (0-indexed)
    expect(offsite?.start.getDate()).toBe(1);
  });

  it("unfolds continuation lines per RFC 5545", () => {
    const events = parseIcsEvents(SAMPLE_ICS);
    const longTitle = events.find((e) => e.title.startsWith("Long summary"));
    expect(longTitle?.title).toBe("Long summary thatwraps onto a folded continuation line");
  });

  it("sorts events by start time", () => {
    const events = parseIcsEvents(SAMPLE_ICS);
    const starts = events.map((e) => e.start.getTime());
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it("returns an empty array for text with no VEVENTs", () => {
    expect(parseIcsEvents("BEGIN:VCALENDAR\nEND:VCALENDAR")).toEqual([]);
  });
});
