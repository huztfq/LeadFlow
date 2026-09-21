import { describe, expect, it } from "vitest";
import {
  extractPersonalizationFacts,
  fallbackOpener,
  hasPersonalizationFacts,
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
      }),
    ).toBe("Noticed you're GM at Kirkin in Florida, United States.");
  });
});
