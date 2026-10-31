import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { speedAuditFrom } from "@/lib/apollo-context";
import { fetchSpeedAudit, SpeedAuditError } from "@/lib/speed-audit";
import type { Prisma } from "@/generated/prisma/client";

const postSchema = z.object({ url: z.string().min(1) });

type RouteContext = { params: Promise<{ id: string }> };

function rawRecord(rawJson: unknown): Record<string, unknown> {
  return rawJson && typeof rawJson === "object" && !Array.isArray(rawJson)
    ? { ...(rawJson as Record<string, unknown>) }
    : {};
}

/** Fetches the Pronto report JSON and stores it on the lead as `rawJson.speedAudit`. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Paste a speed audit report URL" }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id }, select: { rawJson: true } });
  if (!lead) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  let speedAudit;
  try {
    speedAudit = await fetchSpeedAudit(parsed.data.url);
  } catch (error) {
    if (error instanceof SpeedAuditError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }

  const rawJson = { ...rawRecord(lead.rawJson), speedAudit };
  await prisma.lead.update({
    where: { id },
    data: { rawJson: rawJson as Prisma.InputJsonObject },
  });

  return NextResponse.json({ speedAudit: speedAuditFrom(rawJson) });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id }, select: { rawJson: true } });
  if (!lead) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const rawJson = rawRecord(lead.rawJson);
  delete rawJson.speedAudit;
  await prisma.lead.update({
    where: { id },
    data: { rawJson: rawJson as Prisma.InputJsonObject },
  });

  return NextResponse.json({ speedAudit: null });
}
