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
});
