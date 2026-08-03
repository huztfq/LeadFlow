import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { searchPeople, type ApolloSearchFilters } from "@/lib/apollo";
import { assertApolloCreditsAvailable, CreditLimitExceededError } from "@/lib/team";

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
