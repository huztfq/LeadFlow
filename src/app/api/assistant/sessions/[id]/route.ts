import type { InputJsonValue } from "@prisma/client/runtime/client";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  deriveSessionTitle,
  parseStoredMessages,
  parseStoredPlan,
  toChatSessionDetail,
} from "@/lib/chat-session";

type RouteParams = { params: Promise<{ id: string }> };

function isNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const record = await prisma.chatSession.findUnique({ where: { id } });
    if (!record) {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }
    return NextResponse.json({ session: toChatSessionDetail(record) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database error";
    console.error("GET /api/assistant/sessions/[id] failed:", message);
    return NextResponse.json({ error: "Could not load chat session." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Prisma.ChatSessionUpdateInput = {};

  if (typeof body.title === "string" && body.title.trim()) {
    data.title = body.title.trim();
  }
  if (typeof body.pinned === "boolean") {
    data.pinned = body.pinned;
  }
  if ("messages" in body) {
    const messages = parseStoredMessages(body.messages);
    data.messages = messages as unknown as InputJsonValue;
    if (typeof data.title !== "string") {
      const derived = deriveSessionTitle(messages);
      if (derived) data.title = derived;
    }
  }
  if ("plan" in body) {
    const plan = parseStoredPlan(body.plan);
    data.plan = plan ? (plan as unknown as InputJsonValue) : Prisma.JsonNull;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  try {
    const record = await prisma.chatSession.update({ where: { id }, data });
    return NextResponse.json({ session: toChatSessionDetail(record) });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Database error";
    console.error("PATCH /api/assistant/sessions/[id] failed:", message);
    return NextResponse.json({ error: "Could not update chat session." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    await prisma.chatSession.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Database error";
    console.error("DELETE /api/assistant/sessions/[id] failed:", message);
    return NextResponse.json({ error: "Could not delete chat session." }, { status: 500 });
  }
}
