import { prisma } from "@/lib/db";
import { CampaignStatus } from "@/generated/prisma/enums";

/**
 * Every path that creates an enrollment (manual enroll, the assistant's
 * outreach-plan executor) already flips a `draft` campaign to `active` at
 * that moment, and the cron sender only ever sends for campaigns that are
 * already `active`. So in the steady state a campaign can never have real
 * send activity while still reading `draft`.
 *
 * This is a defensive self-heal for the one case that isn't covered by that
 * invariant: rows created or edited outside those code paths (a manual DB
 * fix, a future import script, a restored backup, etc.) that leave a
 * campaign with enrollments/sends stuck on `draft`. Called on every campaign
 * read so the UI never has to special-case "draft but clearly not inert".
 */
export async function backfillDraftCampaignsWithActivity(
  campaignIds?: string[],
): Promise<string[]> {
  const stale = await prisma.campaign.findMany({
    where: {
      status: CampaignStatus.draft,
      ...(campaignIds ? { id: { in: campaignIds } } : {}),
      enrollments: { some: {} },
    },
    select: { id: true },
  });

  if (stale.length === 0) return [];

  const ids = stale.map((c) => c.id);
  await prisma.campaign.updateMany({
    where: { id: { in: ids } },
    data: { status: CampaignStatus.active },
  });
  return ids;
}
