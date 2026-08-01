import { describe, expect, it } from "vitest";
import { renderTemplate } from "./merge-fields";

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
});
