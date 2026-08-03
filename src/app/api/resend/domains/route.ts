import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createDomain, getDomain, listDomains, type ResendDomainError } from "@/lib/resend-domains";

const createDomainSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
});

function errorStatus(error: unknown): number {
  const statusCode = (error as ResendDomainError | undefined)?.statusCode;
  if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 600) return statusCode;
  return 502;
}

export async function GET(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const domains = await listDomains();
    return NextResponse.json({ domains });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list domains";
    return NextResponse.json({ error: message }, { status: errorStatus(error) });
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createDomainSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid domain data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name } = parsed.data;

  try {
    const domain = await createDomain(name);
    return NextResponse.json({ domain }, { status: 201 });
  } catch (error) {
    // Resend rejects creating a domain that's already registered on the
    // account — surface the existing domain (with its DNS records) instead
    // of a bare error, so the UI can drop straight into the setup flow.
    try {
      const existing = (await listDomains()).find(
        (domain) => domain.name.toLowerCase() === name.toLowerCase(),
      );
      if (existing) {
        const domain = await getDomain(existing.id);
        return NextResponse.json({ domain, alreadyExists: true });
      }
    } catch {
      // fall through to the original error below
    }

    const message = error instanceof Error ? error.message : "Failed to create domain";
    return NextResponse.json({ error: message }, { status: errorStatus(error) });
  }
}
