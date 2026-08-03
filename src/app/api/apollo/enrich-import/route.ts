import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { enrichPeopleByIds } from "@/lib/apollo";
import {
  importCandidates,
  normalizeApolloPerson,
  type ImportCandidate,
  type ImportSummary,
} from "@/lib/import-leads";
import { prismaImportDb } from "@/lib/prisma-import-db";
import { assertApolloCreditsAvailable, consumeApolloCredits, CreditLimitExceededError } from "@/lib/team";

/**
 * Enrich selected Apollo people (credits) then persist to Postgres.
 * Body: { apolloIds: string[] }
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertApolloCreditsAvailable(user);
  } catch (error) {
    if (error instanceof CreditLimitExceededError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  let body: { apolloIds?: string[] };
  try {
    body = (await request.json()) as { apolloIds?: string[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const apolloIds = Array.isArray(body.apolloIds)
    ? [...new Set(body.apolloIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];

  if (apolloIds.length === 0) {
    return NextResponse.json({ error: "No apolloIds provided" }, { status: 400 });
  }

  if (apolloIds.length > 25) {
    return NextResponse.json({ error: "Max 25 people per enrich batch" }, { status: 400 });
  }

  try {
    const enrichResult = await enrichPeopleByIds(apolloIds);
    await consumeApolloCredits(user.id, enrichResult.enriched);

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
    const summary: ImportSummary & {
      enriched: number;
      enrichFailed: number;
    } = {
      ...importResult,
      skippedNoEmail,
      enriched: enrichResult.enriched,
      enrichFailed: enrichResult.failed,
    };

    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Enrich/import failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
