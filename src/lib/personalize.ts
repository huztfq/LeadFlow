import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import {
  extractPersonalizationFacts,
  fallbackOpener,
  hasPersonalizationFacts,
  storeOpener,
  type PersonalizationFacts,
} from "@/lib/apollo-context";

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

const openerSchema = z.object({
  opener: z
    .string()
    .describe("One or two sentences of personalized opening copy. Empty if facts are too thin."),
});

const SYSTEM = `You write the opening 1–2 sentences of a B2B cold email.
Rules:
- Use ONLY facts in the JSON. Do not invent posts, awards, funding, metrics, or personal details.
- Do not greet by first name (the template already says Hi {{firstName}}).
- Do not pitch the product or repeat the rest of the email. Just a specific observation that shows you looked at their role/company.
- Plain text only. No HTML, no quotes around the whole opener.
- If facts are too thin to be specific, return an empty opener.`;

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\{\{[^}]+\}\}/g, " ").replace(/\s+/g, " ").trim();
}

export async function generatePersonalizedOpener(input: {
  lead: {
    firstName?: string | null;
    lastName?: string | null;
    title?: string | null;
    company?: string | null;
    industry?: string | null;
    location?: string | null;
    rawJson?: unknown;
  };
  campaignName?: string | null;
  emailSubject?: string | null;
  emailBodyHtml?: string | null;
}): Promise<string> {
  const facts = extractPersonalizationFacts(input.lead);
  if (!hasPersonalizationFacts(facts)) return "";

  // Storefront facts beat anything Claude could say from a job title.
  if (facts.store) return storeOpener(facts);

  if (!process.env.ANTHROPIC_API_KEY) {
    return fallbackOpener(facts);
  }

  try {
    const { object } = await generateObject({
      model: anthropic(ANTHROPIC_MODEL),
      schema: openerSchema,
      system: SYSTEM,
      prompt: JSON.stringify({
        facts,
        campaignName: input.campaignName ?? null,
        subject: input.emailSubject ?? null,
        emailPreview: input.emailBodyHtml ? stripHtml(input.emailBodyHtml).slice(0, 280) : null,
      }),
    });
    return object.opener.trim();
  } catch {
    return fallbackOpener(facts);
  }
}

export type { PersonalizationFacts };
