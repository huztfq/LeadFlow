import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const stepInputSchema = z.object({
  delayDays: z.number().int().min(0, "delayDays must be >= 0"),
  subject: z.string().trim().min(1, "subject is required"),
  bodyHtml: z.string().trim().min(1, "bodyHtml is required"),
});

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  steps: z.array(stepInputSchema).min(1, "at least one step is required"),
});

export async function GET(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { steps: true, enrollments: true } } },
  });

  return NextResponse.json({
    campaigns: campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      createdAt: campaign.createdAt,
      stepCount: campaign._count.steps,
      enrollmentCount: campaign._count.enrollments,
    })),
  });
}

export async function POST(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid campaign data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, steps } = parsed.data;

  const campaign = await prisma.campaign.create({
    data: {
      name,
      steps: {
        create: steps.map((step, index) => ({
          stepOrder: index,
          delayDays: step.delayDays,
          subject: step.subject,
          bodyHtml: step.bodyHtml,
        })),
      },
    },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
