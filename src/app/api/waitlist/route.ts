import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Public waitlist signup — sign-up is invite-only during the private beta, so
 * this just records a lead for the team to follow up with manually. No
 * account, password, or session is created. Re-submitting the same email
 * updates the row (name/useCase) instead of erroring.
 */
export async function POST(request: NextRequest) {
  let body: { name?: string; email?: string; useCase?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const useCase = (body.useCase ?? "").trim();

  if (!name || name.length > 200) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }
  if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (useCase.length > 500) {
    return NextResponse.json({ error: "Keep that under 500 characters." }, { status: 400 });
  }

  await prisma.waitlistSignup.upsert({
    where: { email },
    create: { name, email, useCase: useCase || null },
    update: { name, useCase: useCase || null },
  });

  return NextResponse.json({ ok: true });
}
