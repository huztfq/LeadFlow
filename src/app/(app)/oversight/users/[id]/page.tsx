"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { OversightInviteRow, OversightUserDetail } from "@/lib/oversight";
import { formatRelativeTime } from "@/lib/format-time";

function formatLimit(used: number, limit: number | null): string {
  if (limit === null) return `${used} / unlimited`;
  return `${used} / ${limit}`;
}

function usagePct(used: number, limit: number | null): number {
  if (limit === null || limit === 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function CreditBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = usagePct(used, limit);
  const over = limit !== null && used >= limit;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[var(--ink-soft)]">{label}</span>
        <span className={over ? "font-semibold text-[var(--danger)]" : "text-[var(--muted)]"}>
          {formatLimit(used, limit)}
        </span>
      </div>
      {limit !== null ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--paper)]">
          <div
            className={`h-full rounded-full ${over ? "bg-[var(--danger)]" : "bg-[var(--signal)]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function inviteStatusClass(status: OversightInviteRow["status"]): string {
  switch (status) {
    case "accepted":
      return "bg-[var(--signal-soft)] text-[var(--signal-deep)]";
    case "expired":
      return "bg-red-50 text-[var(--danger)]";
    case "pending":
    default:
      return "bg-amber-50 text-amber-900";
  }
}

type LoadState = "loading" | "denied" | "not_found" | "ready" | "error";

export default function OversightUserDetailPage() {
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>("loading");
  const [detail, setDetail] = useState<OversightUserDetail | null>(null);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      setError("");
      try {
        const response = await fetch(`/api/oversight/users/${params.id}`);
        if (response.status === 403) {
          setState("denied");
          return;
        }
        if (response.status === 404) {
          setState("not_found");
          return;
        }
        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "Failed to load this account");
          setState("error");
          return;
        }
        setDetail(data as OversightUserDetail);
        setState("ready");
      } catch {
        setError("Failed to load this account. Check your connection and try again.");
        setState("error");
      }
    });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (state === "loading") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 py-6 sm:px-8 sm:py-8">
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 py-6 sm:px-8 sm:py-8">
        <p className="lf-alert lf-alert-error">You don&apos;t have access to Oversight.</p>
        <Link href="/assistant" className="lf-btn lf-btn-ghost self-start">
          Back to Studio
        </Link>
      </div>
    );
  }

  if (state === "not_found" || !detail) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 py-6 sm:px-8 sm:py-8">
        <p className="lf-alert lf-alert-error">{error || "That account couldn't be found."}</p>
        <Link href="/oversight" className="lf-btn lf-btn-ghost self-start">
          Back to Oversight
        </Link>
      </div>
    );
  }

  const { user, chatSessions, invitesSent, lastActivityAt } = detail;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6 sm:gap-6 sm:px-8 sm:py-8">
      <div className="lf-rise flex flex-col gap-2">
        <Link href="/oversight" className="text-xs font-semibold text-[var(--signal-deep)]">
          ← Oversight
        </Link>
        <h1 className="lf-display mt-1 text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
          {user.name || user.email}
        </h1>
        {user.name ? <p className="text-sm text-[var(--muted)]">{user.email}</p> : null}
      </div>

      {error ? <p className="lf-alert lf-alert-error">{error}</p> : null}

      <div className="lf-card flex flex-col gap-3 p-6">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Profile</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[var(--muted)]">Email</dt>
            <dd className="text-[var(--ink)]">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Username</dt>
            <dd className="text-[var(--ink)]">{user.username ? `@${user.username}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Joined</dt>
            <dd className="text-[var(--ink)]" title={new Date(user.createdAt).toLocaleString()}>
              {formatRelativeTime(user.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Invite accepted</dt>
            <dd className="text-[var(--ink)]">
              {user.acceptedAt ? (
                <span title={new Date(user.acceptedAt).toLocaleString()}>{formatRelativeTime(user.acceptedAt)}</span>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Last activity</dt>
            <dd className="text-[var(--ink)]" title={new Date(lastActivityAt).toLocaleString()}>
              {formatRelativeTime(lastActivityAt)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="lf-card flex flex-col gap-4 p-6">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Credit usage</h2>
        <div className="flex flex-col gap-4">
          <CreditBar label="Apollo credits" used={user.apolloCreditsUsed} limit={user.apolloCreditLimit} />
          <CreditBar label="AI credits" used={user.aiCreditsUsed} limit={user.aiCreditLimit} />
        </div>
      </div>

      <div className="lf-card flex flex-col gap-3 p-6">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Recent chat sessions</h2>
        {chatSessions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No Studio chats yet.</p>
        ) : (
          <ul className="flex flex-col">
            {chatSessions.map((session, index) => (
              <li
                key={session.id}
                className={`flex items-center justify-between gap-3 py-2.5 text-sm ${index === 0 ? "" : "border-t border-[var(--line)]"}`}
              >
                <span className="min-w-0 truncate text-[var(--ink)]">
                  {session.pinned ? "📌 " : ""}
                  {session.title}
                </span>
                <span
                  className="shrink-0 text-xs text-[var(--muted)]"
                  title={new Date(session.updatedAt).toLocaleString()}
                >
                  {formatRelativeTime(session.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="lf-card flex flex-col gap-3 p-6">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Invites sent</h2>
        {invitesSent.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Hasn&apos;t invited anyone yet.</p>
        ) : (
          <ul className="flex flex-col">
            {invitesSent.map((invite, index) => (
              <li
                key={invite.id}
                className={`flex items-center justify-between gap-3 py-2.5 text-sm ${index === 0 ? "" : "border-t border-[var(--line)]"}`}
              >
                <span className="min-w-0 truncate text-[var(--ink)]">{invite.email}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${inviteStatusClass(invite.status)}`}>
                    {invite.status}
                  </span>
                  <span className="text-xs text-[var(--muted)]" title={new Date(invite.createdAt).toLocaleString()}>
                    {formatRelativeTime(invite.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-[var(--muted)]">
        Campaign and email-send activity is shared across the whole workspace rather than tied to a specific
        person — see the{" "}
        <Link href="/oversight" className="font-medium text-[var(--signal-deep)] hover:underline">
          Oversight activity feed
        </Link>{" "}
        for the latest sends and replies.
      </p>
    </div>
  );
}
