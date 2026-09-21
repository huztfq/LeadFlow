import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEND_WINDOW,
  isInSendWindow,
  nextSendWindowStart,
  sendWindowFromEnv,
  utcOffsetHoursFor,
} from "./send-window";

// Friday 18 Sep 2026, 21:48 UTC — the moment the last HubSpot batch went out.
const fridayNight = new Date("2026-09-18T21:48:00Z");

describe("utcOffsetHoursFor", () => {
  it("maps common lead locations to offsets (September = DST in the north, standard time in AU)", () => {
    expect(utcOffsetHoursFor("London, United Kingdom", fridayNight)).toBe(1);
    expect(utcOffsetHoursFor("Toronto, Canada", fridayNight)).toBe(-4);
    expect(utcOffsetHoursFor("Vancouver, British Columbia", fridayNight)).toBe(-7);
    expect(utcOffsetHoursFor("Sydney, Australia", fridayNight)).toBe(10);
    expect(utcOffsetHoursFor("Perth, Western Australia", fridayNight)).toBe(8);
    expect(utcOffsetHoursFor("Auckland, New Zealand", fridayNight)).toBe(12);
    expect(utcOffsetHoursFor("Riverside, Missouri, United States", fridayNight)).toBe(-5);
    expect(utcOffsetHoursFor("Los Angeles, California", fridayNight)).toBe(-7);
  });

  it("switches Sydney to AEDT after the first Sunday in October", () => {
    expect(utcOffsetHoursFor("Sydney, Australia", new Date("2026-10-20T00:00:00Z"))).toBe(11);
  });

  it("falls back to US Eastern when nothing matches", () => {
    expect(utcOffsetHoursFor(null, fridayNight)).toBe(-5);
    expect(utcOffsetHoursFor("Atlantis", fridayNight)).toBe(-5);
  });
});

describe("isInSendWindow", () => {
  it("rejects Friday 22:48 in London and Saturday 07:48 in Sydney", () => {
    expect(isInSendWindow(fridayNight, "London, United Kingdom")).toBe(false);
    expect(isInSendWindow(fridayNight, "Sydney, Australia")).toBe(false);
  });

  it("accepts a Tuesday mid-morning in the recipient's zone", () => {
    // 09:30 BST on Tue 22 Sep = 08:30 UTC
    expect(isInSendWindow(new Date("2026-09-22T08:30:00Z"), "London, United Kingdom")).toBe(true);
    // 09:30 AEST on Tue 22 Sep = 23:30 UTC Mon 21 Sep
    expect(isInSendWindow(new Date("2026-09-21T23:30:00Z"), "Sydney, Australia")).toBe(true);
  });

  it("rejects the window edge and weekends", () => {
    // 16:00 local exactly is closed.
    expect(isInSendWindow(new Date("2026-09-22T15:00:00Z"), "London, United Kingdom")).toBe(false);
    // Saturday noon local.
    expect(isInSendWindow(new Date("2026-09-19T11:00:00Z"), "London, United Kingdom")).toBe(false);
  });
});

describe("nextSendWindowStart", () => {
  it("returns the same instant when already inside the window", () => {
    const inside = new Date("2026-09-22T08:30:00Z");
    expect(nextSendWindowStart(inside, "London, United Kingdom")).toEqual(inside);
  });

  it("pushes a Friday-night London send to Monday 08:00 BST", () => {
    expect(nextSendWindowStart(fridayNight, "London, United Kingdom").toISOString()).toBe(
      "2026-09-21T07:00:00.000Z",
    );
  });

  it("pushes a Saturday-morning Sydney send to Monday 08:00 AEST", () => {
    expect(nextSendWindowStart(fridayNight, "Sydney, Australia").toISOString()).toBe(
      "2026-09-20T22:00:00.000Z",
    );
  });

  it("uses the same day when the window has not opened yet", () => {
    // 06:00 EDT Tuesday = 10:00 UTC → opens 08:00 EDT = 12:00 UTC
    expect(nextSendWindowStart(new Date("2026-09-22T10:00:00Z"), "Toronto, Canada").toISOString()).toBe(
      "2026-09-22T12:00:00.000Z",
    );
  });
});

describe("sendWindowFromEnv", () => {
  it("defaults when unset or malformed", () => {
    expect(sendWindowFromEnv(undefined)).toEqual(DEFAULT_SEND_WINDOW);
    expect(sendWindowFromEnv("banana")).toEqual(DEFAULT_SEND_WINDOW);
    expect(sendWindowFromEnv("16-8")).toEqual(DEFAULT_SEND_WINDOW);
  });

  it("parses hours and optional day range, and can be disabled", () => {
    expect(sendWindowFromEnv("9-11")).toEqual({ startHour: 9, endHour: 11, days: [1, 2, 3, 4, 5] });
    expect(sendWindowFromEnv("9-11:2-4")).toEqual({ startHour: 9, endHour: 11, days: [2, 3, 4] });
    expect(sendWindowFromEnv("off")).toBeNull();
  });
});
