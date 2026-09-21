import { describe, expect, it } from "vitest";
import { BOOKING_URL, appendCampaignChrome, buildCampaignFooter, htmlToText } from "./campaign-email";

describe("htmlToText", () => {
  it("turns a campaign email into a readable plain-text part with visible links", () => {
    const html =
      `<p>Hi Ada,</p><p>Noticed you&rsquo;re Founder at Acme.</p>` +
      `<p>Best,<br/>Huzaifa</p>` +
      `<p style="margin-top:20px;">Grab a time: <a href="${BOOKING_URL}">${BOOKING_URL}</a></p>` +
      `<p>Don't want these? <a href="https://app.example/u/1">Unsubscribe</a>.</p>`;
    const text = htmlToText(html);
    expect(text).toBe(
      [
        "Hi Ada,",
        "",
        "Noticed you’re Founder at Acme.",
        "",
        "Best,",
        "Huzaifa",
        "",
        `Grab a time: ${BOOKING_URL}`,
        "",
        "Don't want these? Unsubscribe (https://app.example/u/1).",
      ].join("\n"),
    );
  });

  it("drops scripts and styles and decodes numeric entities", () => {
    expect(htmlToText(`<style>p{}</style><p>&#8212; ok &amp; &#x2019;</p>`)).toBe("— ok & ’");
  });
});

describe("appendCampaignChrome", () => {
  it("adds the booking link and an Inferaform footer", () => {
    const html = appendCampaignChrome("<p>Hi Ada,</p>", "https://app.example/unsub");
    expect(html).toContain(BOOKING_URL);
    expect(html).toContain("If 15 minutes would help");
    expect(html).toContain("Sent by Inferaform");
    expect(html).toContain("https://app.example/unsub");
    expect(html).not.toContain("Leadflow");
  });

  it("does not duplicate the booking link", () => {
    const once = appendCampaignChrome(`<p><a href="${BOOKING_URL}">book</a></p>`, "https://app.example/unsub");
    expect(once.split(BOOKING_URL).length - 1).toBe(1);
  });

  it("names Inferaform in the footer", () => {
    expect(buildCampaignFooter("/u")).toContain("Inferaform");
    expect(buildCampaignFooter("/u")).not.toContain("Leadflow");
  });
});
