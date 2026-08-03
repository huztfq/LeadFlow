import type { InputJsonValue } from "@prisma/client/runtime/client";
import { NextRequest, NextResponse } from "next/server";
import type { UIMessage } from "ai";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  deriveSessionTitle,
  parseStoredMessages,
  parseStoredPlan,
  toChatSessionSummary,
} from "@/lib/chat-session";

/** Studio chats are private per account — always scoped to `userId`, never
 * listed/created/looked-up globally. A null `userId` (pre-migration rows, or
 * a session orphaned by account deletion) never matches, so it's invisible. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const records = await prisma.chatSession.findMany({
      where: { userId: user.id },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      select: { id: true, title: true, pinned: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ sessions: records.map(toChatSessionSummary) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database error";
    console.error("GET /api/assistant/sessions failed:", message);
    return NextResponse.json({ error: "Could not load chat history." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { title?: string; messages?: UIMessage[]; plan?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = parseStoredMessages(body.messages);
  const plan = parseStoredPlan(body.plan);
  const title = body.title?.trim() || deriveSessionTitle(messages) || "New chat";

  try {
    const record = await prisma.chatSession.create({
      data: {
        userId: user.id,
        title,
        messages: messages as unknown as InputJsonValue,
        plan: plan ? (plan as unknown as InputJsonValue) : Prisma.JsonNull,
      },
    });
    return NextResponse.json({ session: toChatSessionSummary(record) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database error";
    console.error("POST /api/assistant/sessions failed:", message);
    return NextResponse.json({ error: "Could not create chat session." }, { status: 500 });
  }
}
