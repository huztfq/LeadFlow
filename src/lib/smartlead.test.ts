import { describe, expect, it } from "vitest";
import {
  buildSequences,
  campaignSchedule,
  eligibleForPush,
  leadflowIdFromName,
  matchesAudience,
  parseSmartleadWebhook,
  renderLeadForSmartlead,
  smartleadCampaignName,
} from "./smartlead";
import { BOOKING_URL } from "./campaign-email";

const steps = [
  { stepOrder: 1, delayDays: 3, subject: "", bodyHtml: "<p>Just bumping this, {{firstName}}.</p>" },
  { stepOrder: 0, delayDays: 0, subject: "quick question for {{company}}", bodyHtml: "<p>Hi {{firstName}},</p><p>Body for {{company}}.</p>" },
  { stepOrder: 2, delayDays: 4, subject: "different angle", bodyHtml: "<p>Last one.</p>" },
];

const lead = {
  id: "lead1",
  email: "dana@kith.com",
  firstName: "Dana",
  lastName: "Lee",
  company: "Kith",
  title: "Founder",
  industry: "Retail",
  location: "New York, US",
  phone: null,
  rawJson: { organization: { website_url: "https://kith.com" } },
};

describe("campaign naming", () => {
  it("round-trips the Leadflow id through the Smartlead name", () => {
    const name = smartleadCampaignName("Speed audit: water", "cmvwj39g00000fnycy90mhh39");
    expect(name).toBe("Speed audit: water [lf:cmvwj39g00000fnycy90mhh39]");
    expect(leadflowIdFromName(name)).toBe("cmvwj39g00000fnycy90mhh39");
    expect(leadflowIdFromName("Someone else's campaign")).toBeNull();
  });
});

describe("buildSequences", () => {
  it("orders steps, threads follow-ups, keeps a follow-up's own subject", () => {
    expect(buildSequences(steps)).toEqual([
      { seq_number: 1, seq_delay_details: { delay_in_days: 0 }, subject: "{{lf_subject_1}}", email_body: "{{lf_body_1}}" },
      { seq_number: 2, seq_delay_details: { delay_in_days: 3 }, subject: "", email_body: "{{lf_body_2}}" },
      { seq_number: 3, seq_delay_details: { delay_in_days: 4 }, subject: "{{lf_subject_3}}", email_body: "{{lf_body_3}}" },
    ]);
  });
});

describe("renderLeadForSmartlead", () => {
  it("renders every step with merge fields, the opener and the booking link", () => {
    const out = renderLeadForSmartlead(lead, steps, "Saw the linen drop sold out in M.");
    expect(out).toMatchObject({ email: "dana@kith.com", first_name: "Dana", company_name: "Kith", website: "https://kith.com" });
    expect(out.custom_fields.lf_lead_id).toBe("lead1");
    expect(out.custom_fields.lf_subject_1).toBe("quick question for Kith");
    expect(out.custom_fields.lf_body_1).toContain("<p>Saw the linen drop sold out in M.</p>");
    expect(out.custom_fields.lf_body_1).toContain("Body for Kith.");
    expect(out.custom_fields.lf_body_1).toContain(BOOKING_URL);
    expect(out.custom_fields.lf_body_2).toContain("Just bumping this, Dana.");
    expect(out.custom_fields.lf_body_2).not.toContain("Saw the linen");
    expect(Object.values(out.custom_fields).join(" ")).not.toMatch(/\{\{/);
  });

  it("falls back to 'Hi there' and drops the empty opener", () => {
    const out = renderLeadForSmartlead({ ...lead, firstName: null }, steps, "");
    expect(out.custom_fields.lf_body_1).toContain("Hi there,");
    expect(out.custom_fields.lf_body_1).not.toContain("<p></p>");
  });
});

describe("lead selection", () => {
  const base = { email: "a@b.com", rawJson: { audience: { grade: "A", segment: "ecommerce" } }, enrollments: [] };

  it("skips leads already pushed, opted out, bounced or replied", () => {
    expect(eligibleForPush(base, "c1")).toBe(true);
    expect(eligibleForPush({ ...base, email: null }, "c1")).toBe(false);
    const pushed = { ...base, rawJson: { ...base.rawJson, smartlead: { campaigns: { c1: { smartleadCampaignId: 1, pushedAt: "x" } } } } };
    expect(eligibleForPush(pushed, "c1")).toBe(false);
    expect(eligibleForPush(pushed, "c2")).toBe(true);
    expect(eligibleForPush({ ...base, rawJson: { smartlead: { unsubscribedAt: "x" } } }, "c1")).toBe(false);
    expect(eligibleForPush({ ...base, rawJson: { smartlead: { repliedAt: "x" } } }, "c1")).toBe(false);
    expect(eligibleForPush({ ...base, enrollments: [{ status: "unsubscribed" }] }, "c1")).toBe(false);
  });

  it("matches the audience grade and segment", () => {
    expect(matchesAudience(base.rawJson, { grades: ["A"] })).toBe(true);
    expect(matchesAudience(base.rawJson, { grades: ["B"] })).toBe(false);
    expect(matchesAudience(base.rawJson, { grades: ["A", "B"], segment: "local_service" })).toBe(false);
    expect(matchesAudience({}, { grades: ["A"] })).toBe(false);
  });
});

describe("parseSmartleadWebhook", () => {
  it("reads a reply", () => {
    const event = parseSmartleadWebhook({
      event_type: "EMAIL_REPLY",
      campaign_id: 4287008,
      campaign_name: "Speed audit [lf:abc123]",
      sl_lead_email: "Dana@Kith.com",
      from_email: "dana@kith.com",
      to_email: "huzaifa@tryinferaform.com",
      subject: "Re: quick question",
      reply_message: { message_id: "<m1@mail>", text: "Sure, send times", html: "<p>Sure, send times</p>" },
    });
    expect(event).toEqual({
      type: "reply",
      rawType: "EMAIL_REPLY",
      leadEmail: "dana@kith.com",
      smartleadCampaignId: 4287008,
      leadflowCampaignId: "abc123",
      subject: "Re: quick question",
      text: "Sure, send times",
      html: "<p>Sure, send times</p>",
      messageId: "<m1@mail>",
      mailbox: "huzaifa@tryinferaform.com",
    });
  });

  it("reads unsubscribes and bounces, ignores the rest", () => {
    expect(parseSmartleadWebhook({ event_type: "LEAD_UNSUBSCRIBED", lead_email: "x@y.com" }).type).toBe("unsubscribe");
    expect(parseSmartleadWebhook({ event_type: "EMAIL_BOUNCE", lead_data: { email: "x@y.com" } })).toMatchObject({ type: "bounce", leadEmail: "x@y.com" });
    expect(parseSmartleadWebhook({ event_type: "EMAIL_SENT" }).type).toBe("other");
    expect(parseSmartleadWebhook(null).leadEmail).toBeNull();
  });
});

describe("campaignSchedule", () => {
  it("scales new leads per day with mailboxes", () => {
    expect(campaignSchedule(0).max_new_leads_per_day).toBe(10);
    expect(campaignSchedule(4).max_new_leads_per_day).toBe(80);
  });
});
