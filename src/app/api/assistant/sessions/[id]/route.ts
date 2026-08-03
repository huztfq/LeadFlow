import type { InputJsonValue } from "@prisma/client/runtime/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
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

/** Studio chats are private per account — every lookup below is scoped to
 * `{ id, userId: user.id }` so a session owned by (or orphaned from) another
 * account 404s exactly like a missing one, rather than leaking its contents. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const record = await prisma.chatSession.findFirst({ where: { id, userId: user.id } });
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
  const user = await getCurrentUser(request);
  if (!user) {
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
    // updateMany (rather than update-by-id) folds the ownership check and the
    // write into one atomic query, so there's no gap where a "not mine" 403
    // could race with a concurrent delete/transfer.
    const { count } = await prisma.chatSession.updateMany({ where: { id, userId: user.id }, data });
    if (count === 0) {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }
    const record = await prisma.chatSession.findUniqueOrThrow({ where: { id } });
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
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const { count } = await prisma.chatSession.deleteMany({ where: { id, userId: user.id } });
    if (count === 0) {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database error";
    console.error("DELETE /api/assistant/sessions/[id] failed:", message);
    return NextResponse.json({ error: "Could not delete chat session." }, { status: 500 });
  }
}
