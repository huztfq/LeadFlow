import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import {
  importCandidates,
  normalizeApolloPerson,
  type ApolloPerson,
  type ImportCandidate,
  type ImportSummary,
} from "@/lib/import-leads";
import { prismaImportDb } from "@/lib/prisma-import-db";

export async function POST(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { people?: ApolloPerson[] };
  try {
    body = (await request.json()) as { people?: ApolloPerson[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const people = Array.isArray(body.people) ? body.people : [];

  let skippedNoEmail = 0;
  const candidates: ImportCandidate[] = [];
  for (const person of people) {
    const candidate = normalizeApolloPerson(person);
    if (!candidate) {
      skippedNoEmail += 1;
      continue;
    }
    candidates.push(candidate);
  }

  const result = await importCandidates(candidates, prismaImportDb);
  const summary: ImportSummary = { ...result, skippedNoEmail };

  return NextResponse.json(summary);
}
