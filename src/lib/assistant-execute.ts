import { enrichPeopleByIds, searchPeople } from "@/lib/apollo";
import {
  importCandidates,
  normalizeApolloPerson,
  type ImportCandidate,
} from "@/lib/import-leads";
import { prismaImportDb } from "@/lib/prisma-import-db";
import { prisma } from "@/lib/db";
import { CampaignStatus, EnrollmentStatus } from "@/generated/prisma/enums";
import { normalizeOutreachPlan, type OutreachPlan } from "@/lib/assistant-plan";

export type ExecuteResult = {
  searched: number;
  withEmailFlag: number;
  enriched: number;
  enrichFailed: number;
  imported: number;
  updated: number;
  skippedNoEmail: number;
  importFailed: number;
  campaignId: string;
  campaignName: string;
  enrolled: number;
  leadIds: string[];
};

export async function executeOutreachPlan(rawPlan: OutreachPlan): Promise<ExecuteResult> {
  const plan = normalizeOutreachPlan(rawPlan);
  const targetCount = Math.min(plan.search.targetCount, 30);

  const search = await searchPeople({
    q_keywords: plan.search.q_keywords,
    person_titles: plan.search.person_titles,
    person_locations: plan.search.person_locations,
    q_organization_industry_keywords: plan.search.industry,
    contact_email_status: ["verified", "unverified"],
    per_page: Math.min(Math.max(targetCount * 2, 10), 100),
    page: 1,
  });

  const preferred = search.people.filter((p) => p.has_email && p.id);
  const pool = (preferred.length > 0 ? preferred : search.people.filter((p) => p.id)).slice(
    0,
    targetCount,
  );
  const apolloIds = pool.map((p) => p.id!).filter(Boolean);

  const enrichResult = await enrichPeopleByIds(apolloIds);

  let skippedNoEmail = 0;
  const candidates: ImportCandidate[] = [];
  for (const person of enrichResult.people) {
    const candidate = normalizeApolloPerson(person);
    if (!candidate) {
      skippedNoEmail += 1;
      continue;
    }
    candidates.push(candidate);
  }

  const importResult = await importCandidates(candidates, prismaImportDb);

  // Resolve lead ids for enrollment (by email)
  const emails = candidates.map((c) => c.email);
  const leads = await prisma.lead.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const leadIds = leads.map((l) => l.id);

  const campaign = await prisma.campaign.create({
    data: {
      name: plan.campaign.name,
      steps: {
        create: plan.campaign.steps.map((step, index) => ({
          stepOrder: index,
          delayDays: step.delayDays,
          subject: step.subject,
          bodyHtml: step.bodyHtml,
        })),
      },
    },
  });

  const now = new Date();
  if (leadIds.length > 0) {
    await prisma.enrollment.createMany({
      data: leadIds.map((leadId) => ({
        campaignId: campaign.id,
        leadId,
        currentStep: 0,
        status: EnrollmentStatus.active,
        nextSendAt: now,
        attemptCount: 0,
      })),
      skipDuplicates: true,
    });
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: CampaignStatus.active },
    });
  }

  const enrolled = await prisma.enrollment.count({ where: { campaignId: campaign.id } });

  return {
    searched: search.people.length,
    withEmailFlag: preferred.length,
    enriched: enrichResult.enriched,
    enrichFailed: enrichResult.failed,
    imported: importResult.imported,
    updated: importResult.updated,
    skippedNoEmail: skippedNoEmail + importResult.skippedNoEmail,
    importFailed: importResult.failed,
    campaignId: campaign.id,
    campaignName: campaign.name,
    enrolled,
    leadIds,
  };
}
