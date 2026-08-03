import type { InputJsonValue } from "@prisma/client/runtime/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { toChatSessionSummary } from "@/lib/chat-session";

type RouteParams = { params: Promise<{ id: string }> };

const TITLE_MAX_LENGTH = 60;

function forkTitle(title: string): string {
  const base = title.trim() || "New chat";
  const trimmed =
    base.length > TITLE_MAX_LENGTH - 8 ? `${base.slice(0, TITLE_MAX_LENGTH - 9).trimEnd()}…` : base;
  return `${trimmed} (fork)`;
}

/** Duplicate a chat session (messages + plan) into a brand new session, so
 * exploring an alternate direction never mutates the original transcript.
 * Only the owning account can fork its own chat — scoped the same way as
 * the other session routes so this can't be used to peek at another
 * account's transcript via the copy it creates. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const source = await prisma.chatSession.findFirst({ where: { id, userId: user.id } });
    if (!source) {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }

    const created = await prisma.chatSession.create({
      data: {
        userId: user.id,
        title: forkTitle(source.title),
        messages: source.messages as InputJsonValue,
        plan: source.plan === null ? Prisma.JsonNull : (source.plan as InputJsonValue),
        pinned: false,
      },
    });

    return NextResponse.json({ session: toChatSessionSummary(created) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database error";
    console.error("POST /api/assistant/sessions/[id]/fork failed:", message);
    return NextResponse.json({ error: "Could not fork chat session." }, { status: 500 });
  }
}
