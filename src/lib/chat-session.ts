import type { UIMessage } from "ai";
import { outreachPlanSchema, type OutreachPlan } from "@/lib/assistant-plan";

export type ChatSessionSummary = {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChatSessionDetail = ChatSessionSummary & {
  messages: UIMessage[];
  plan: OutreachPlan | null;
};

const TITLE_MAX_LENGTH = 60;

/** Raw record shape as read back from Prisma (Json columns are `unknown`, dates are `Date`). */
type RawChatSessionRecord = {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type RawChatSessionDetailRecord = RawChatSessionRecord & {
  messages: unknown;
  plan: unknown;
};

export function toChatSessionSummary(record: RawChatSessionRecord): ChatSessionSummary {
  return {
    id: record.id,
    title: record.title,
    pinned: record.pinned,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toChatSessionDetail(record: RawChatSessionDetailRecord): ChatSessionDetail {
  return {
    ...toChatSessionSummary(record),
    messages: parseStoredMessages(record.messages),
    plan: parseStoredPlan(record.plan),
  };
}

/** Best-effort parse — a session's `messages` Json column should always be an array. */
export function parseStoredMessages(value: unknown): UIMessage[] {
  return Array.isArray(value) ? (value as UIMessage[]) : [];
}

export function parseStoredPlan(value: unknown): OutreachPlan | null {
  if (!value || typeof value !== "object") return null;
  const parsed = outreachPlanSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function getMessagePlainText(message: UIMessage): string {
  if (!message.parts?.length) return "";
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join(" ");
}

function truncateTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= TITLE_MAX_LENGTH) return clean;
  return `${clean.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

/** A session's title is auto-derived from its first user message, truncated. */
export function deriveSessionTitle(messages: UIMessage[]): string | null {
  for (const message of messages) {
    if (message.role !== "user") continue;
    const text = getMessagePlainText(message).trim();
    if (text) return truncateTitle(text);
  }
  return null;
}
