import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 25;

export function buildLeadsWhere(q: string, industry: string): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
    ];
  }
  if (industry) {
    where.industry = { contains: industry, mode: "insensitive" };
  }
  return where;
}

function contactStatus(
  enrollments: { status: string; campaign: { name: string; status: string } }[],
): { status: string; detail: string } {
  if (enrollments.length === 0) {
    return { status: "new", detail: "Not in a campaign" };
  }

  const priority = ["active", "paused", "completed", "failed", "bounced", "unsubscribed"];
  // Prefer active campaign enrollment; else first by priority
  const activeEnrollment = enrollments.find((e) => e.status === "active");
  const pick =
    activeEnrollment ??
    [...enrollments].sort(
      (a, b) => priority.indexOf(a.status) - priority.indexOf(b.status),
    )[0];

  const campaignLabel = pick.campaign.name;
  if (pick.status === "active") {
    return { status: "in_campaign", detail: `Active in ${campaignLabel}` };
  }
  if (pick.status === "completed") {
    return { status: "completed", detail: `Completed · ${campaignLabel}` };
  }
  if (pick.status === "unsubscribed") {
    return { status: "unsubscribed", detail: `Unsubscribed · ${campaignLabel}` };
  }
  if (pick.status === "failed" || pick.status === "bounced") {
    return { status: pick.status, detail: `${pick.status} · ${campaignLabel}` };
  }
  return { status: pick.status, detail: `${pick.status} · ${campaignLabel}` };
}

export async function GET(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const industry = searchParams.get("industry")?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const where = buildLeadsWhere(q, industry);

  try {
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { importedAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          title: true,
          company: true,
          industry: true,
          location: true,
          phone: true,
          importedAt: true,
          enrollments: {
            select: {
              status: true,
              campaign: { select: { name: true, status: true } },
            },
            orderBy: { updatedAt: "desc" },
          },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    const mapped = leads.map((lead) => {
      const { enrollments, ...rest } = lead;
      const { status, detail } = contactStatus(enrollments);
      return {
        ...rest,
        status,
        statusDetail: detail,
        campaignCount: enrollments.length,
      };
    });

    return NextResponse.json({ leads: mapped, total, page, pageSize: PAGE_SIZE });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database error";
    console.error("GET /api/leads failed:", message);
    return NextResponse.json(
      {
        error:
          "Could not load contacts from the database. Check DATABASE_URL in .env (quote it if the password has # @ % etc).",
      },
      { status: 500 },
    );
  }
}
