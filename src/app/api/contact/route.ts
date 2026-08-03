import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendContactNotification } from "@/lib/contact";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Public contact form (marketing site's `/contact`) — always persists the
 * message to `ContactMessage` first, then best-effort emails a notification
 * via Resend (see `sendContactNotification`). No account or session involved.
 */
export async function POST(request: NextRequest) {
  let body: { name?: string; email?: string; company?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const company = (body.company ?? "").trim();
  const message = (body.message ?? "").trim();

  if (!name || name.length > 200) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }
  if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (company.length > 200) {
    return NextResponse.json({ error: "Keep the company name under 200 characters." }, { status: 400 });
  }
  if (!message || message.length > 5000) {
    return NextResponse.json(
      { error: message ? "Keep your message under 5000 characters." : "Enter a message." },
      { status: 400 },
    );
  }

  await prisma.contactMessage.create({
    data: { name, email, company: company || null, message },
  });

  await sendContactNotification({ name, email, company: company || null, message });

  return NextResponse.json({ ok: true });
}
