import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeDisplayName, isUniqueConstraintError, profileUpdateSchema, toProfileSummary } from "@/lib/profile";

/** The signed-in user's own editable profile fields. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ profile: toProfileSummary(user) });
}

/**
 * Updates the signed-in user's own name/username/email — never another
 * account's. Username/email uniqueness is pre-checked for a friendly error,
 * then re-guarded by the DB's unique constraint against a race.
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

  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid profile data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { firstName, lastName, username, email } = parsed.data;
  if (firstName === undefined && lastName === undefined && username === undefined && email === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  if (username) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
    }
  }

  if (email && email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
    }
  }

  const nextFirstName = firstName === undefined ? user.firstName : firstName;
  const nextLastName = lastName === undefined ? user.lastName : lastName;

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: firstName === undefined ? undefined : firstName,
        lastName: lastName === undefined ? undefined : lastName,
        username: username === undefined ? undefined : username,
        email: email === undefined ? undefined : email,
        name: computeDisplayName(nextFirstName, nextLastName, user.name),
      },
    });
    return NextResponse.json({ profile: toProfileSummary(updated) });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "That username or email is already in use" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
