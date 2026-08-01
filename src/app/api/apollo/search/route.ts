import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { searchPeople, type ApolloSearchFilters } from "@/lib/apollo";

export async function POST(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let filters: ApolloSearchFilters;
  try {
    filters = (await request.json()) as ApolloSearchFilters;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await searchPeople(filters);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Apollo search failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
