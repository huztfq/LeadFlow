import { describe, expect, it } from "vitest";
import {
  classifySegment,
  detectSiteSignals,
  exclusionReason,
  inNorthAmerica,
  isDecisionMaker,
  pickContacts,
  scoreAudience,
  siteUrl,
  storeFactsFromProducts,
  unreachableSignals,
  type HubSpotCompany,
  type HubSpotContact,
} from "./hubspot-audience";

const NOW = new Date("2026-11-01T12:00:00Z");

function contact(over: Partial<HubSpotContact> = {}): HubSpotContact {
  return {
    id: "1",
    email: "jane@brand.com",
    firstName: "Jane",
    lastName: "Doe",
    jobTitle: "Founder",
    phone: null,
    city: null,
    state: null,
    country: "United States",
    lifecycleStage: "lead",
    optedOut: false,
    hardBounced: false,
    lastContactedAt: null,
    companyId: "10",
    ...over,
  };
}

function company(over: Partial<HubSpotCompany> = {}): HubSpotCompany {
  return {
    id: "10",
    name: "Brand Co",
    domain: "brand.com",
    website: null,
    industry: "APPAREL_FASHION",
    description: null,
    employees: 12,
    city: null,
    state: null,
    country: "United States",
    lifecycleStage: "lead",
    ...over,
  };
}

describe("exclusionReason", () => {
  it("keeps a normal prospect", () => {
    expect(exclusionReason(contact(), company(), { now: NOW })).toBeNull();
  });

  it("drops customers, unsubscribes, bounces and recent contacts", () => {
    expect(exclusionReason(contact({ lifecycleStage: "customer" }), company(), { now: NOW })).toBe("current customer");
    expect(exclusionReason(contact(), company({ lifecycleStage: "customer" }), { now: NOW })).toBe("current customer");
    expect(exclusionReason(contact({ optedOut: true }), company(), { now: NOW })).toBe("unsubscribed");
    expect(exclusionReason(contact({ hardBounced: true }), company(), { now: NOW })).toBe("bounced");
    expect(exclusionReason(contact({ lastContactedAt: "2026-10-20T00:00:00Z" }), company(), { now: NOW })).toMatch(/contacted/);
    expect(exclusionReason(contact({ lastContactedAt: "2026-08-01T00:00:00Z" }), company(), { now: NOW })).toBeNull();
  });

  it("drops non-North-America and out-of-range sizes, but not unknowns", () => {
    expect(exclusionReason(contact({ country: "Germany" }), company({ country: null }), { now: NOW })).toBe("outside US/Canada");
    expect(exclusionReason(contact({ country: null }), company({ country: null }), { now: NOW })).toBeNull();
    expect(exclusionReason(contact(), company({ employees: 400 }), { now: NOW })).toBe("400 employees");
    expect(exclusionReason(contact(), company({ employees: null }), { now: NOW })).toBeNull();
    expect(exclusionReason(contact({ email: null }), company(), { now: NOW })).toBe("no email");
  });
});

describe("segments and people", () => {
  it("classifies e-commerce, local service, and leaves agencies out", () => {
    expect(classifySegment(company(), null)).toBe("ecommerce");
    expect(classifySegment(company({ industry: null, name: "Pure Water Softeners LLC" }), null)).toBe("local_service");
    expect(classifySegment(company({ industry: "MARKETING_AND_ADVERTISING" }), null)).toBeNull();
    expect(classifySegment(company({ industry: null, name: "Northwind" }), null)).toBeNull();
    const shopify = { ...unreachableSignals(), reachable: true, shopify: true };
    expect(classifySegment(company({ industry: null, name: "Northwind" }), shopify)).toBe("ecommerce");
    // "marketing" in a brand's description doesn't make it an agency.
    expect(classifySegment(company({ description: "Our marketing team loves linen" }), null)).toBe("ecommerce");
  });

  it("recognises decision makers", () => {
    expect(isDecisionMaker("Co-Founder & CEO", "ecommerce")).toBe(true);
    expect(isDecisionMaker("Head of Growth", "ecommerce")).toBe(true);
    expect(isDecisionMaker("Customer Service Rep", "ecommerce")).toBe(false);
    expect(isDecisionMaker("Office Manager", "local_service")).toBe(true);
    expect(isDecisionMaker("Office Manager", "ecommerce")).toBe(false);
  });

  it("picks named decision makers over generic inboxes, max 2", () => {
    const rows = [
      { contact: contact({ id: "a", email: "hello@brand.com", jobTitle: null }) },
      { contact: contact({ id: "b", jobTitle: "Owner" }) },
      { contact: contact({ id: "c", email: "sam@brand.com", jobTitle: "CMO" }) },
      { contact: contact({ id: "d", email: "lee@brand.com", jobTitle: "CEO" }) },
    ];
    expect(pickContacts(rows, "ecommerce").map((r) => r.contact.id)).toEqual(["b", "c"]);
    expect(pickContacts([rows[0]], "ecommerce").map((r) => r.contact.id)).toEqual(["a"]);
  });

  it("knows North America", () => {
    expect(inNorthAmerica("USA")).toBe(true);
    expect(inNorthAmerica(null, "Canada")).toBe(true);
    expect(inNorthAmerica("UK")).toBe(false);
    expect(inNorthAmerica(null, "")).toBeNull();
  });
});

describe("website signals", () => {
  const shopifyHtml = `
    <script src="https://cdn.shopify.com/s/files/theme.js"></script>
    <script>!function(f,b,e,v,n,t,s){}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','123');</script>
    <script async src="https://static.klaviyo.com/onsite/js/klaviyo.js"></script>
    <form action="/search"><input name="q"></form>`;

  it("detects Shopify, ads tags and tools", () => {
    const s = detectSiteSignals(shopifyHtml);
    expect(s).toMatchObject({ shopify: true, metaPixel: true, googleAds: false, tiktokPixel: false, emailFlowsTool: "Klaviyo", smsTool: null, leadForm: false });
  });

  it("detects the Meta pixel in Shopify's web-pixel config", () => {
    const html = `<script>webPixelsConfigList: [{"configuration":"{\\"pixel_id\\":\\"57942\\",\\"pixel_type\\":\\"facebook_pixel\\"}"}]</script>`;
    expect(detectSiteSignals(html).metaPixel).toBe(true);
  });

  it("detects local lead capture", () => {
    const html = `<a href="tel:+15551234567">Call</a>
      <script>gtag('config','AW-123456789')</script>
      <form><input name="name"><input type="tel" name="phone"><textarea></textarea></form>`;
    const s = detectSiteSignals(html);
    expect(s).toMatchObject({ googleAds: true, leadForm: true, phoneOnSite: true, chatWidget: null, bookingTool: null });
    expect(detectSiteSignals(`${html}<script src="https://connect.podium.com/widget.js"></script>`).chatWidget).toBe("Podium");
  });

  it("builds store facts from products.json", () => {
    const store = storeFactsFromProducts(
      [
        { title: "Linen Shirt", variants: [{ title: "S", available: false }, { title: "M", available: true }] },
        { title: "Cap", variants: [{ title: "Default Title", available: false }] },
        { title: "Tee", variants: [{ title: "S", available: true }] },
      ],
      false,
      "2026-11-01T00:00:00Z",
    );
    expect(store).toEqual({
      checkedAt: "2026-11-01T00:00:00Z",
      productCount: 3,
      soldOutProducts: 1,
      example: { title: "Linen Shirt", variants: ["S"] },
      hasBackInStock: false,
    });
  });

  it("normalises the website", () => {
    expect(siteUrl(company({ website: "http://www.brand.com/shop" }))).toBe("https://www.brand.com");
    expect(siteUrl(company({ website: null, domain: "brand.com" }))).toBe("https://brand.com");
    expect(siteUrl(company({ website: null, domain: null }))).toBeNull();
  });
});

describe("scoreAudience", () => {
  const base = { ...unreachableSignals(), reachable: true };
  const bigStore = { checkedAt: null, productCount: 40, soldOutProducts: 2, example: { title: "Shirt", variants: ["S"] }, hasBackInStock: false };

  it("grades e-commerce", () => {
    expect(scoreAudience("ecommerce", { ...base, metaPixel: true }, bigStore).grade).toBe("A");
    expect(scoreAudience("ecommerce", { ...base, metaPixel: true }, bigStore).reasons).toContain("sold-out items, no back-in-stock option");
    expect(scoreAudience("ecommerce", { ...base }, bigStore).grade).toBe("B");
    const covered = { ...base, emailFlowsTool: "Klaviyo", smsTool: "Postscript", backInStock: true };
    expect(scoreAudience("ecommerce", covered, bigStore).grade).toBe("C");
    expect(scoreAudience("ecommerce", { ...base, metaPixel: true }, { ...bigStore, productCount: 4 }).grade).toBe("C");
  });

  it("grades local service", () => {
    expect(scoreAudience("local_service", { ...base, googleAds: true, leadForm: true }, null).grade).toBe("A");
    expect(scoreAudience("local_service", { ...base, phoneOnSite: true }, null).grade).toBe("B");
    expect(scoreAudience("local_service", { ...base, googleAds: true, leadForm: true, chatWidget: "Podium" }, null).grade).toBe("C");
  });

  it("grades an unreachable site C", () => {
    expect(scoreAudience("ecommerce", unreachableSignals(), null)).toEqual({ grade: "C", reasons: ["website not reachable"] });
  });
});
