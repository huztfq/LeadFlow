import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSpeedAudit, parseProntoReportUrl } from "./speed-audit";

describe("parseProntoReportUrl", () => {
  it("accepts report links with or without .json", () => {
    expect(parseProntoReportUrl("https://pronto.inferaform.com/r/abc_123")).toBe(
      "https://pronto.inferaform.com/r/abc_123",
    );
    expect(parseProntoReportUrl(" https://pronto.inferaform.com/r/abc123.json?x=1 ")).toBe(
      "https://pronto.inferaform.com/r/abc123",
    );
  });

  it("rejects other hosts, schemes and paths", () => {
    expect(parseProntoReportUrl("https://evil.example.com/r/abc123")).toBeNull();
    expect(parseProntoReportUrl("https://pronto.inferaform.com.evil.com/r/abc123")).toBeNull();
    expect(parseProntoReportUrl("http://pronto.inferaform.com/r/abc123")).toBeNull();
    expect(parseProntoReportUrl("https://pronto.inferaform.com:8443/r/abc123")).toBeNull();
    expect(parseProntoReportUrl("https://pronto.inferaform.com/admin")).toBeNull();
    expect(parseProntoReportUrl("not a url")).toBeNull();
  });
});

describe("fetchSpeedAudit", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches the JSON report and maps it to the stored shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        business: "Clearwater Plumbing",
        website: "https://clearwater.example",
        testedAt: "2026-10-27T14:00:00Z",
        responseSeconds: 15120,
        firstResponseChannel: "sms",
        reportUrl: "https://pronto.inferaform.com/r/abc123",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSpeedAudit("https://pronto.inferaform.com/r/abc123")).resolves.toEqual({
      reportUrl: "https://pronto.inferaform.com/r/abc123",
      responseSeconds: 15120,
      channel: "sms",
      testedAt: "2026-10-27T14:00:00.000Z",
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://pronto.inferaform.com/r/abc123.json");
  });

  it("refuses non-Pronto URLs without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchSpeedAudit("https://example.com/r/abc123")).rejects.toThrow(/report link/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed report JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ testedAt: "nope" })));
    await expect(fetchSpeedAudit("https://pronto.inferaform.com/r/abc123")).rejects.toThrow(/missing fields/);
  });
});
