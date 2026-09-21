import { describe, expect, it } from "vitest";
import { ensureOpenerSlot, renderTemplate, stripEmptyOpenerParagraphs } from "./merge-fields";

describe("renderTemplate", () => {
  it("replaces known merge fields and blanks missing ones", () => {
    const out = renderTemplate("Hi {{firstName}} at {{company}} ({{title}})", {
      firstName: "Ada",
      lastName: "Lovelace",
      company: null,
      title: "Engineer",
    });
    expect(out).toBe("Hi Ada at  (Engineer)");
  });

  it("replaces lastName", () => {
    const out = renderTemplate("Dear {{lastName}}", {
      lastName: "Lovelace",
    });
    expect(out).toBe("Dear Lovelace");
  });

  it("blanks unknown merge tokens", () => {
    const out = renderTemplate("Hi {{unknown}}", {});
    expect(out).toBe("Hi ");
  });

  it("replaces opener, industry, and location", () => {
    const out = renderTemplate("<p>{{opener}}</p>", {
      opener: "Noticed you're GM at Kirkin.",
      industry: "construction",
      location: "Florida",
    });
    expect(out).toBe("<p>Noticed you're GM at Kirkin.</p>");
  });
});

describe("ensureOpenerSlot", () => {
  it("leaves a template that already has {{opener}}", () => {
    const html = "<p>Hi {{firstName}},</p><p>{{opener}}</p><p>Pitch.</p>";
    expect(ensureOpenerSlot(html)).toBe(html);
  });

  it("inserts {{opener}} after a Hi {{firstName}} greeting", () => {
    expect(ensureOpenerSlot("<p>Hi {{firstName}},</p><p>Pitch.</p>")).toBe(
      "<p>Hi {{firstName}},</p>\n<p>{{opener}}</p><p>Pitch.</p>",
    );
  });

  it("strips empty opener paragraphs after render", () => {
    expect(stripEmptyOpenerParagraphs("<p>Hi Ada,</p><p></p><p>Pitch.</p>")).toBe(
      "<p>Hi Ada,</p><p>Pitch.</p>",
    );
  });
});
