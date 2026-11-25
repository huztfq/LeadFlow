import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getResend } from "@/lib/resend";

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
  // The waitlist lives on leadflow.inferaform.com; inferaform.com stays allowed too.
  const allowed = new Set([marketingUrl, "https://leadflow.inferaform.com", "https://www.leadflow.inferaform.com", "https://inferaform.com", "https://www.inferaform.com", "http://localhost:3001"]);
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

  // Tell the team. The sign-up is already saved, so a failed email only gets logged.
  await notifyTeam({ name, email, useCase }).catch((err) => console.error("waitlist notify failed:", err));

  return withCors(request, NextResponse.json({ ok: true }));
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * One email per address in WAITLIST_NOTIFY_TO (comma-separated, falls back to OWNER_EMAIL),
 * so an address Resend refuses never stops the others from getting it.
 */
async function notifyTeam(s: { name: string; email: string; useCase: string }) {
  const from = process.env.RESEND_FROM_EMAIL;
  const to = String(process.env.WAITLIST_NOTIFY_TO || process.env.OWNER_EMAIL || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!from || !to.length || !process.env.RESEND_API_KEY) {
    console.error("waitlist notify: RESEND_API_KEY, RESEND_FROM_EMAIL or WAITLIST_NOTIFY_TO is not set");
    return;
  }
  const resend = getResend();
  const subject = `New Leadflow waitlist sign-up: ${s.name}`;
  const text = `Someone joined the Leadflow waitlist.\n\nName: ${s.name}\nEmail: ${s.email}\nUse case: ${s.useCase || "Not given"}\n\nAllow them from the Oversight page, or reply to this email.`;
  const html = `<p>Someone joined the Leadflow waitlist.</p><p><b>Name:</b> ${esc(s.name)}<br><b>Email:</b> ${esc(s.email)}<br><b>Use case:</b> ${esc(s.useCase || "Not given")}</p><p>Allow them from the Oversight page, or reply to this email.</p>`;
  const results = await Promise.allSettled(to.map((address) => resend.emails.send({ from, to: [address], replyTo: s.email, subject, text, html })));
  for (const r of results) {
    if (r.status === "rejected") console.error("waitlist notify:", r.reason);
    else if (r.value.error) console.error("waitlist notify:", r.value.error);
  }
}
