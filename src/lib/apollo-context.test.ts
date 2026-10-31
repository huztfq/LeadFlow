import { describe, expect, it } from "vitest";
import {
  extractPersonalizationFacts,
  fallbackOpener,
  formatResponseTime,
  hasPersonalizationFacts,
  speedAuditFrom,
  storeOpener,
} from "./apollo-context";

describe("storeOpener", () => {
  it("names the sold-out product and variants and notes a missing back-in-stock option", () => {
    const facts = extractPersonalizationFacts({
      company: "Locks Lash",
      rawJson: {
        source: "hubspot",
        store: {
          checkedAt: "2026-09-18T21:00:00Z",
          productCount: 42,
          soldOutProducts: 3,
          example: { title: "Volume Lash Kit", variants: ["0.07 C", "0.07 D"] },
          hasBackInStock: false,
        },
      },
    });
    expect(facts.store?.example?.variants).toEqual(["0.07 C", "0.07 D"]);
    expect(hasPersonalizationFacts(facts)).toBe(true);
    expect(storeOpener(facts)).toBe(
      "When I looked on Locks Lash, Volume Lash Kit was sold out in 0.07 C and 0.07 D, and I couldn't see a back-in-stock option on the page.",
    );
  });

  it("skips the Default Title variant and the notify remark when a widget exists", () => {
    const facts = extractPersonalizationFacts({
      company: "Sproot Baby",
      rawJson: { store: { example: { title: "Linen Bib", variants: ["Default Title"] }, hasBackInStock: true } },
    });
    expect(storeOpener(facts)).toBe("When I looked on Sproot Baby, Linen Bib was sold out.");
  });

  it("falls back to the in-stock line and to nothing when the store block is empty", () => {
    expect(storeOpener(extractPersonalizationFacts({ company: "Acme", rawJson: { store: { productCount: 12 } } }))).toBe(
      "Had a look through Acme — 12 products, all in stock when I checked.",
    );
    expect(storeOpener(extractPersonalizationFacts({ company: "Acme", rawJson: { store: {} } }))).toBe("");
    expect(extractPersonalizationFacts({ company: "Acme", rawJson: {} }).store).toBeNull();
  });
});

const rawJson = {
  title: "Owner",
  headline: "titolare",
  seniority: "owner",
  first_name: "Letizia",
  last_name: "Mattei",
  city: "Bagno A Ripoli",
  country: "Italy",
  employment_history: [
    { title: "Owner", organization_name: "Max-Model" },
    { title: "Designer", organization_name: "Studio X" },
  ],
  organization: {
    name: "Max-Model",
    industry: "mechanical or industrial engineering",
    short_description: "Max-Model is a small company that puts his heart into models.",
    website_url: "http://www.max-model.it",
    keywords: ["modellismo", "graphic design"],
    estimated_num_employees: 1,
  },
};

describe("extractPersonalizationFacts", () => {
  it("prefers lead columns and fills the rest from Apollo rawJson", () => {
    const facts = extractPersonalizationFacts({
      firstName: "Letizia",
      lastName: "Mattei",
      title: "Owner",
      company: "Max-Model",
      industry: null,
      location: null,
      rawJson,
    });
    expect(facts.industry).toBe("mechanical or industrial engineering");
    expect(facts.website).toBe("http://www.max-model.it");
    expect(facts.employeeCount).toBe(1);
    expect(facts.keywords).toEqual(["modellismo", "graphic design"]);
    expect(facts.recentRoles[0]).toBe("Owner at Max-Model");
    expect(facts.companyDescription).toMatch(/Max-Model/);
    expect(hasPersonalizationFacts(facts)).toBe(true);
  });

  it("returns no facts for an empty lead", () => {
    expect(hasPersonalizationFacts(extractPersonalizationFacts({}))).toBe(false);
    expect(fallbackOpener(extractPersonalizationFacts({}))).toBe("");
  });
});

describe("fallbackOpener", () => {
  it("uses title, company, and location only", () => {
    expect(
      fallbackOpener({
        firstName: "Ada",
        lastName: "Lovelace",
        title: "GM",
        headline: null,
        seniority: null,
        company: "Kirkin",
        industry: null,
        companyDescription: null,
        website: null,
        keywords: [],
        employeeCount: null,
        location: "Florida, United States",
        recentRoles: [],
        store: null,
        local: null,
        speedAudit: null,
      }),
    ).toBe("Noticed you're GM at Kirkin in Florida, United States.");
  });

  it("mentions the offer from a local business website", () => {
    const facts = extractPersonalizationFacts({
      company: "Ocala Roofing Inc.",
      rawJson: { local: { niche: "roofing", offer: "Free roofing estimate", serviceArea: ["Ocala"] } },
    });
    expect(hasPersonalizationFacts(facts)).toBe(true);
    expect(facts.local?.serviceArea).toEqual(["Ocala"]);
    expect(fallbackOpener(facts)).toBe("Saw on the Ocala Roofing Inc. site that you offer free roofing estimate.");
  });
});

describe("formatResponseTime", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatResponseTime(1)).toBe("1 second");
    expect(formatResponseTime(47)).toBe("47 seconds");
    expect(formatResponseTime(60)).toBe("1 minute");
    expect(formatResponseTime(12 * 60 + 30)).toBe("12 minutes");
    expect(formatResponseTime(4 * 3600 + 12 * 60)).toBe("4h 12m");
    expect(formatResponseTime(3 * 3600)).toBe("3h");
    expect(formatResponseTime(26 * 3600 + 5 * 60)).toBe("26h 5m");
  });

  it("says there was no reply when seconds are missing", () => {
    expect(formatResponseTime(null)).toBe("no reply after 48 hours");
  });
});

describe("speedAuditFrom", () => {
  const speedAudit = {
    reportUrl: "https://pronto.inferaform.com/r/abc123",
    responseSeconds: 15120,
    channel: "sms",
    testedAt: "2026-10-27T14:00:00.000Z",
  };

  it("reads rawJson.speedAudit and adds a readable response time", () => {
    expect(speedAuditFrom({ source: "apollo", speedAudit })).toEqual({
      ...speedAudit,
      responseTime: "4h 12m",
    });
  });

  it("keeps a no-reply audit", () => {
    const audit = speedAuditFrom({ speedAudit: { ...speedAudit, responseSeconds: null, channel: null } });
    expect(audit?.responseSeconds).toBeNull();
    expect(audit?.channel).toBeNull();
    expect(audit?.responseTime).toBe("no reply after 48 hours");
  });

  it("drops unknown channels and bad seconds", () => {
    const audit = speedAuditFrom({ speedAudit: { ...speedAudit, responseSeconds: -5, channel: "fax" } });
    expect(audit?.responseSeconds).toBeNull();
    expect(audit?.channel).toBeNull();
  });

  it("returns null without an audit or report URL", () => {
    expect(speedAuditFrom(null)).toBeNull();
    expect(speedAuditFrom({})).toBeNull();
    expect(speedAuditFrom({ speedAudit: { ...speedAudit, reportUrl: "" } })).toBeNull();
  });

  it("is included in personalization facts", () => {
    const facts = extractPersonalizationFacts({ rawJson: { speedAudit } });
    expect(facts.speedAudit?.responseTime).toBe("4h 12m");
    expect(hasPersonalizationFacts(facts)).toBe(true);
  });
});
