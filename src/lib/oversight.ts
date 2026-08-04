import { prisma } from "@/lib/db";
import type { User, WaitlistStatus } from "@/generated/prisma/client";
import { toUserSummary, type UserSummary } from "@/lib/team";

/** Account-wide counters for the Oversight summary strip. */
export type OversightSummary = {
  totalUsers: number;
  pendingInvites: number;
  pendingWaitlist: number;
  totalSends: number;
  totalChatSessions: number;
  aiCreditsUsedTotal: number;
  apolloCreditsUsedTotal: number;
};

export async function getOversightSummary(): Promise<OversightSummary> {
  const [totalUsers, pendingInvites, pendingWaitlist, totalSends, totalChatSessions, creditTotals] =
    await Promise.all([
      prisma.user.count(),
      prisma.invite.count({ where: { acceptedAt: null } }),
      prisma.waitlistSignup.count({ where: { status: "pending" } }),
      prisma.sendLog.count(),
      prisma.chatSession.count(),
      prisma.user.aggregate({ _sum: { aiCreditsUsed: true, apolloCreditsUsed: true } }),
    ]);

  return {
    totalUsers,
    pendingInvites,
    pendingWaitlist,
    totalSends,
    totalChatSessions,
    aiCreditsUsedTotal: creditTotals._sum.aiCreditsUsed ?? 0,
    apolloCreditsUsedTotal: creditTotals._sum.apolloCreditsUsed ?? 0,
  };
}

export type OversightWaitlistRow = {
  id: string;
  name: string;
  email: string;
  useCase: string | null;
  status: WaitlistStatus;
  createdAt: string;
};

/** Every waitlist signup, newest first, for the Oversight "Waitlist" section. */
export async function getOversightWaitlist(): Promise<OversightWaitlistRow[]> {
  const signups = await prisma.waitlistSignup.findMany({ orderBy: { createdAt: "desc" } });
  return signups.map((signup) => ({
    id: signup.id,
    name: signup.name,
    email: signup.email,
    useCase: signup.useCase,
    status: signup.status,
    createdAt: signup.createdAt.toISOString(),
  }));
}

export type OversightUserRow = UserSummary & {
  username: string | null;
  lastActivityAt: string;
  chatSessionCount: number;
  invitesSentCount: number;
};

function latestOf(...dates: (Date | null | undefined)[]): Date {
  return dates.reduce<Date>((latest, candidate) => {
    if (candidate && candidate.getTime() > latest.getTime()) return candidate;
    return latest;
  }, new Date(0));
}

/**
 * Every account plus computed activity signals. `lastActivityAt` combines
 * `User.updatedAt` (bumped by profile edits and credit-usage increments —
 * see `consumeApolloCredits`/`consumeAiCredits`) with their most recent
 * Studio chat, since that's the most granular per-user timestamp available
 * in the current schema. Campaign/send activity is workspace-wide (no
 * per-user attribution yet — see the Activity feed instead).
 */
export async function getOversightUsers(): Promise<OversightUserRow[]> {
  const [users, chatAgg, inviteAgg] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.chatSession.groupBy({
      by: ["userId"],
      where: { userId: { not: null } },
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    prisma.invite.groupBy({
      by: ["invitedById"],
      where: { invitedById: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const chatById = new Map(chatAgg.map((row) => [row.userId as string, row]));
  const inviteCountById = new Map(inviteAgg.map((row) => [row.invitedById as string, row._count._all]));

  return users.map((user) => {
    const chat = chatById.get(user.id);
    return {
      ...toUserSummary(user),
      username: user.username,
      lastActivityAt: latestOf(user.updatedAt, chat?._max.updatedAt, user.acceptedAt).toISOString(),
      chatSessionCount: chat?._count._all ?? 0,
      invitesSentCount: inviteCountById.get(user.id) ?? 0,
    };
  });
}

export type OversightChatSession = {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OversightInviteStatus = "accepted" | "expired" | "pending";

export type OversightInviteRow = {
  id: string;
  email: string;
  status: OversightInviteStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
};

function inviteStatus(invite: { acceptedAt: Date | null; expiresAt: Date }): OversightInviteStatus {
  if (invite.acceptedAt) return "accepted";
  if (invite.expiresAt.getTime() < Date.now()) return "expired";
  return "pending";
}

export type OversightUserDetail = {
  user: UserSummary & { username: string | null };
  lastActivityAt: string;
  chatSessions: OversightChatSession[];
  invitesSent: OversightInviteRow[];
};

export async function getOversightUserDetail(id: string): Promise<OversightUserDetail | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;

  const [chatSessions, invitesSent] = await Promise.all([
    prisma.chatSession.findMany({
      where: { userId: id },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, title: true, pinned: true, createdAt: true, updatedAt: true },
    }),
    prisma.invite.findMany({
      where: { invitedById: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const lastChatAt = chatSessions[0]?.updatedAt ?? null;

  return {
    user: { ...toUserSummary(user), username: user.username },
    lastActivityAt: latestOf(user.updatedAt, lastChatAt, user.acceptedAt).toISOString(),
    chatSessions: chatSessions.map((session) => ({
      id: session.id,
      title: session.title,
      pinned: session.pinned,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    })),
    invitesSent: invitesSent.map((invite) => ({
      id: invite.id,
      email: invite.email,
      status: inviteStatus(invite),
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt.toISOString(),
      acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    })),
  };
}

export type ActivityEventType =
  | "user_joined"
  | "invite_sent"
  | "invite_accepted"
  | "chat_session"
  | "email_sent"
  | "inbox_reply";

export type ActivityEvent = {
  id: string;
  type: ActivityEventType;
  at: string;
  title: string;
  detail?: string;
};

function personLabel(person: { name: string | null; email: string } | null | undefined): string | undefined {
  if (!person) return undefined;
  return person.name?.trim() || person.email;
}

/**
 * Reverse-chronological mix of notable events synthesized from existing
 * tables (no dedicated ActivityLog table for v1 — see the Oversight product
 * note). Pulls the most recent rows from each source table, merges, and
 * returns the newest `limit` overall.
 */
export async function getRecentActivity(limit = 40): Promise<ActivityEvent[]> {
  const perSource = Math.min(limit, 25);

  const [users, invitesSent, invitesAccepted, chatSessions, sendLogs, inboxMessages] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: perSource,
      select: { id: true, email: true, name: true, createdAt: true },
    }),
    prisma.invite.findMany({
      orderBy: { createdAt: "desc" },
      take: perSource,
      select: {
        id: true,
        email: true,
        createdAt: true,
        invitedBy: { select: { email: true, name: true } },
      },
    }),
    prisma.invite.findMany({
      where: { acceptedAt: { not: null } },
      orderBy: { acceptedAt: "desc" },
      take: perSource,
      select: { id: true, email: true, acceptedAt: true },
    }),
    prisma.chatSession.findMany({
      orderBy: { createdAt: "desc" },
      take: perSource,
      select: {
        id: true,
        title: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
      },
    }),
    prisma.sendLog.findMany({
      where: { status: "sent" },
      orderBy: { sentAt: "desc" },
      take: perSource,
      select: {
        id: true,
        sentAt: true,
        step: { select: { subject: true, campaign: { select: { name: true } } } },
        enrollment: { select: { lead: { select: { email: true, firstName: true, lastName: true } } } },
      },
    }),
    prisma.inboxMessage.findMany({
      orderBy: { receivedAt: "desc" },
      take: perSource,
      select: { id: true, fromEmail: true, category: true, receivedAt: true },
    }),
  ]);

  const events: ActivityEvent[] = [];

  for (const user of users) {
    events.push({
      id: `user:${user.id}`,
      type: "user_joined",
      at: user.createdAt.toISOString(),
      title: `${personLabel(user)} joined Leadflow`,
    });
  }

  for (const invite of invitesSent) {
    events.push({
      id: `invite-sent:${invite.id}`,
      type: "invite_sent",
      at: invite.createdAt.toISOString(),
      title: `Invite sent to ${invite.email}`,
      detail: invite.invitedBy ? `by ${personLabel(invite.invitedBy)}` : undefined,
    });
  }

  for (const invite of invitesAccepted) {
    if (!invite.acceptedAt) continue;
    events.push({
      id: `invite-accepted:${invite.id}`,
      type: "invite_accepted",
      at: invite.acceptedAt.toISOString(),
      title: `${invite.email} accepted their invite`,
    });
  }

  for (const session of chatSessions) {
    events.push({
      id: `chat:${session.id}`,
      type: "chat_session",
      at: session.createdAt.toISOString(),
      title: `Studio chat started: "${session.title}"`,
      detail: personLabel(session.user) ?? "Unattributed session",
    });
  }

  for (const send of sendLogs) {
    const lead = send.enrollment.lead;
    const leadLabel = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() || lead.email || "a lead";
    events.push({
      id: `send:${send.id}`,
      type: "email_sent",
      at: send.sentAt.toISOString(),
      title: `Email sent: "${send.step.subject}"`,
      detail: `${send.step.campaign.name} → ${leadLabel}`,
    });
  }

  for (const message of inboxMessages) {
    events.push({
      id: `inbox:${message.id}`,
      type: "inbox_reply",
      at: message.receivedAt.toISOString(),
      title: `Reply from ${message.fromEmail}`,
      detail: message.category.replace(/_/g, " "),
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return events.slice(0, limit);
}

export function displayName(user: Pick<User, "name" | "email">): string {
  return user.name?.trim() || user.email;
}
