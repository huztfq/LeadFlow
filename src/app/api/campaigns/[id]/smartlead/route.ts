import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { smartleadConfigured } from "@/lib/smartlead";
import {
  countPushable,
  pushLeadsToSmartlead,
  setSmartleadStatus,
  smartleadStatus,
} from "@/lib/smartlead-sync";

export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

const audienceSchema = z.object({
  grades: z.array(z.enum(["A", "B", "C"])).min(1),
  segment: z.enum(["ecommerce", "local_service"]).nullish(),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("push"),
    leadIds: z.array(z.string().min(1)).max(1000).optional(),
    audience: audienceSchema.optional(),
    limit: z.number().int().min(1).max(500).default(50),
  }),
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("pause") }),
]);

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Smartlead request failed";
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Smartlead status for this campaign, plus how many HubSpot-audience leads are ready to push. */
export async function GET(request: NextRequest, { params }: RouteContext) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!smartleadConfigured()) return NextResponse.json({ configured: false });
  const { id } = await params;
  try {
    const [status, readyA, readyAB] = await Promise.all([
      smartleadStatus(id),
      countPushable(id, { audience: { grades: ["A"] } }),
      countPushable(id, { audience: { grades: ["A", "B"] } }),
    ]);
    return NextResponse.json({ configured: true, ...status, ready: { A: readyA, AB: readyAB } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!smartleadConfigured()) {
    return NextResponse.json({ error: "SMARTLEAD_API_KEY is not set" }, { status: 400 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const input = parsed.data;
    if (input.action === "push") {
      if (!input.leadIds?.length && !input.audience) {
        return NextResponse.json({ error: "Pick leads or an audience to push" }, { status: 400 });
      }
      const result = await pushLeadsToSmartlead(id, {
        leadIds: input.leadIds,
        audience: input.audience ?? undefined,
        limit: input.limit,
      });
      return NextResponse.json(result);
    }
    await setSmartleadStatus(id, input.action === "start" ? "START" : "PAUSED");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
