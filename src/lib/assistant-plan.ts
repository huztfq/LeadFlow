import { z } from "zod";

export const outreachPlanSchema = z.object({
  summary: z.string().min(1).describe("One-sentence plan summary for the operator"),
  search: z.object({
    q_keywords: z.string().optional().describe("Free-text Apollo keywords"),
    person_titles: z.array(z.string()).optional().describe("Job titles to target"),
    person_locations: z.array(z.string()).optional().describe("Locations / markets"),
    industry: z.string().optional().describe("Industry keywords"),
    targetCount: z
      .number()
      .int()
      .min(1)
      .max(25)
      .describe("How many people to enrich and enroll (1–25)"),
  }),
  campaign: z.object({
    name: z.string().min(1),
    steps: z
      .array(
        z.object({
          delayDays: z.number().int().min(0).describe("Days after previous send; 0 for first email"),
          subject: z.string().min(1),
          bodyHtml: z
            .string()
            .min(1)
            .describe("HTML email body; may use {{firstName}} {{company}} {{title}}"),
        }),
      )
      .min(1)
      .max(5),
  }),
});

export type OutreachPlan = z.infer<typeof outreachPlanSchema>;

export function normalizeOutreachPlan(plan: OutreachPlan): OutreachPlan {
  return {
    ...plan,
    search: {
      ...plan.search,
      person_titles: plan.search.person_titles ?? [],
      person_locations: plan.search.person_locations ?? [],
      targetCount: plan.search.targetCount ?? 10,
    },
  };
}

/** Deep clone so edits to the working copy never mutate the plan a message carries. */
export function clonePlan(plan: OutreachPlan): OutreachPlan {
  return JSON.parse(JSON.stringify(plan)) as OutreachPlan;
}

export function emptyOutreachStep() {
  return { delayDays: 0, subject: "New email", bodyHtml: "<p>Hi {{firstName}},</p>" };
}

/** Plain-text rendering of a plan for the artifact panel's Copy action. */
export function planToText(plan: OutreachPlan): string {
  const lines: string[] = [plan.campaign.name || "Untitled campaign"];
  if (plan.summary) lines.push(plan.summary);

  lines.push("", "Lead search");
  if (plan.search.q_keywords) lines.push(`Keywords: ${plan.search.q_keywords}`);
  if (plan.search.industry) lines.push(`Industry: ${plan.search.industry}`);
  if (plan.search.person_titles?.length) lines.push(`Titles: ${plan.search.person_titles.join(", ")}`);
  if (plan.search.person_locations?.length) {
    lines.push(`Locations: ${plan.search.person_locations.join(", ")}`);
  }
  lines.push(`Target count: ${plan.search.targetCount ?? 10}`);

  lines.push("", "Sequence");
  plan.campaign.steps.forEach((step, index) => {
    lines.push(`${index + 1}. Day ${step.delayDays} — ${step.subject}`);
    const text = step.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text) lines.push(`   ${text}`);
  });

  return lines.join("\n");
}
