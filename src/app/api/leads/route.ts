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

export async function GET(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const industry = searchParams.get("industry")?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const where = buildLeadsWhere(q, industry);

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
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({ leads, total, page, pageSize: PAGE_SIZE });
}
