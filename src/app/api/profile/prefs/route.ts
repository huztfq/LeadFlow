import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { prefsUpdateSchema, toProfileSummary, toUserPrefs } from "@/lib/profile";

/**
 * Merges partial preference updates into the signed-in user's `prefs` JSON
 * bag, preserving any keys not included in this request.
 */
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = prefsUpdateSchema.safeParse((body as { prefs?: unknown })?.prefs ?? body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid preferences" },
      { status: 400 },
    );
  }

  const merged = { ...toUserPrefs(user.prefs), ...parsed.data };
  const updated = await prisma.user.update({ where: { id: user.id }, data: { prefs: merged } });

  return NextResponse.json({ profile: toProfileSummary(updated) });
}
