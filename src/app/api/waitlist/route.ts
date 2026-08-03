import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The waitlist form on the marketing site (a separate origin/deployment)
// posts here directly from the browser, so this needs to answer CORS
// preflights and echo back an allow-origin header for that one origin —
// everything else (including same-origin requests, which skip CORS
// entirely) is unaffected.
function allowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const marketingUrl = (process.env.NEXT_PUBLIC_MARKETING_URL || "https://inferaform.com").replace(/\/$/, "");
  const allowed = new Set([marketingUrl, "http://localhost:3001"]);
  return allowed.has(origin) ? origin : null;
}

function withCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = allowedOrigin(request);
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }
  return response;
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return withCors(request, response);
}

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
    return withCors(request, NextResponse.json({ error: "Invalid request." }, { status: 400 }));
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const useCase = (body.useCase ?? "").trim();

  if (!name || name.length > 200) {
    return withCors(request, NextResponse.json({ error: "Enter your name." }, { status: 400 }));
  }
  if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
    return withCors(request, NextResponse.json({ error: "Enter a valid email address." }, { status: 400 }));
  }
  if (useCase.length > 500) {
    return withCors(request, NextResponse.json({ error: "Keep that under 500 characters." }, { status: 400 }));
  }

  await prisma.waitlistSignup.upsert({
    where: { email },
    create: { name, email, useCase: useCase || null },
    update: { name, useCase: useCase || null },
  });

  return withCors(request, NextResponse.json({ ok: true }));
}
