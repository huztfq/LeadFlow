"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { ActivityEvent, OversightSummary, OversightUserRow } from "@/lib/oversight";
import { OversightActivityFeed } from "@/components/oversight-activity-feed";
import { formatRelativeTime } from "@/lib/format-time";

type AuthState = "checking" | "denied" | "allowed";

const numberFormatter = new Intl.NumberFormat("en-US");

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatCredit(used: number, limit: number | null): string {
  return limit === null ? `${formatNumber(used)}` : `${formatNumber(used)} / ${formatNumber(limit)}`;
}

const SUMMARY_ITEMS: { key: keyof OversightSummary; label: string }[] = [
  { key: "totalUsers", label: "Users" },
  { key: "pendingInvites", label: "Pending invites" },
  { key: "totalSends", label: "Emails sent" },
  { key: "totalChatSessions", label: "Chat sessions" },
  { key: "aiCreditsUsedTotal", label: "AI credits used" },
  { key: "apolloCreditsUsedTotal", label: "Apollo credits used" },
];

export default function OversightPage() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [summary, setSummary] = useState<OversightSummary | null>(null);
  const [users, setUsers] = useState<OversightUserRow[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState("");
  const [, startLoadTransition] = useTransition();

  const load = useCallback(() => {
    startLoadTransition(async () => {
      setError("");
      try {
        const [summaryRes, usersRes, activityRes] = await Promise.all([
          fetch("/api/oversight/summary"),
          fetch("/api/oversight/users"),
          fetch("/api/oversight/activity"),
        ]);

        if (summaryRes.status === 403) {
          setAuthState("denied");
          return;
        }

        const [summaryData, usersData, activityData] = await Promise.all([
          summaryRes.json(),
          usersRes.json(),
          activityRes.json(),
        ]);

        if (!summaryRes.ok || !usersRes.ok || !activityRes.ok) {
          setError(summaryData.error ?? usersData.error ?? activityData.error ?? "Failed to load Oversight");
          setAuthState("allowed");
          return;
        }

        setSummary(summaryData.summary as OversightSummary);
        setUsers(usersData.users as OversightUserRow[]);
        setEvents(activityData.events as ActivityEvent[]);
        setAuthState("allowed");
      } catch {
        setError("Failed to load Oversight. Check your connection and try again.");
        setAuthState("allowed");
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (authState === "denied") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 py-6 sm:px-8 sm:py-8">
        <p className="lf-alert lf-alert-error">You don&apos;t have access to Oversight.</p>
        <Link href="/assistant" className="lf-btn lf-btn-ghost self-start">
          Back to Studio
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-5 py-6 sm:gap-6 sm:px-8 sm:py-8">
      <div className="lf-rise">
        <p className="lf-chip">Admin</p>
        <h1 className="lf-display mt-2 text-3xl font-semibold text-[var(--ink)]">Oversight</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Activity and usage across every account, in one place.</p>
      </div>

      {error ? <p className="lf-alert lf-alert-error">{error}</p> : null}

      {authState === "checking" && !summary ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : null}

      {summary ? (
        <div className="lf-card grid grid-cols-2 gap-px overflow-hidden sm:grid-cols-3 lg:grid-cols-6">
          {SUMMARY_ITEMS.map((item) => (
            <div key={item.key} className="flex flex-col gap-1 bg-[var(--paper-elevated)] px-4 py-4">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{item.label}</span>
              <span className="lf-display text-2xl font-semibold text-[var(--ink)]">
                {formatNumber(summary[item.key])}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {users.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Users</h2>
          <div className="lf-table-wrap">
            <table className="lf-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Apollo credits</th>
                  <th>AI credits</th>
                  <th>Chat sessions</th>
                  <th>Last activity</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-medium text-[var(--ink)]">{user.name || user.email}</span>
                        <span className="text-xs text-[var(--muted)]">
                          {[user.name ? user.email : null, user.username ? `@${user.username}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                    </td>
                    <td>{formatCredit(user.apolloCreditsUsed, user.apolloCreditLimit)}</td>
                    <td>{formatCredit(user.aiCreditsUsed, user.aiCreditLimit)}</td>
                    <td>{formatNumber(user.chatSessionCount)}</td>
                    <td title={new Date(user.lastActivityAt).toLocaleString()}>
                      {formatRelativeTime(user.lastActivityAt)}
                    </td>
                    <td>
                      <Link href={`/oversight/users/${user.id}`} className="font-semibold text-[var(--signal-deep)]">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Activity</h2>
        <div className="lf-card px-4 py-1 sm:px-6">
          <OversightActivityFeed events={events} />
        </div>
      </section>
    </div>
  );
}
