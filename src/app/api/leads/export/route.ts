import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { leadsToCsv } from "@/lib/csv";
import { buildLeadsWhere } from "@/app/api/leads/route";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids")?.trim() ?? "";

  let where: Prisma.LeadWhereInput;
  if (idsParam) {
    const ids = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    where = { id: { in: ids } };
  } else {
    const q = searchParams.get("q")?.trim() ?? "";
    const industry = searchParams.get("industry")?.trim() ?? "";
    where = buildLeadsWhere(q, industry);
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { importedAt: "desc" },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      title: true,
      company: true,
      industry: true,
      location: true,
      phone: true,
    },
  });

  const csv = leadsToCsv(leads);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="leads.csv"',
    },
  });
}
