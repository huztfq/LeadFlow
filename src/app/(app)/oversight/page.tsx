"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState, useTransition } from "react";
import type { ActivityEvent, OversightSummary, OversightUserRow, OversightWaitlistRow } from "@/lib/oversight";
import { OversightActivityFeed } from "@/components/oversight-activity-feed";
import { formatRelativeTime } from "@/lib/format-time";

type AuthState = "checking" | "denied" | "allowed";

// Mirrors WAITLIST_DEFAULT_APOLLO_CREDIT_LIMIT / WAITLIST_DEFAULT_AI_CREDIT_LIMIT
// in src/lib/team.ts (server-only, so not importable from this client page) —
// just the pre-filled starting point shown in the Allow form; the owner can
// change them before confirming.
const WAITLIST_DEFAULT_APOLLO_LIMIT = "50";
const WAITLIST_DEFAULT_AI_LIMIT = "200";

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
  { key: "pendingWaitlist", label: "Waitlist pending" },
  { key: "totalSends", label: "Emails sent" },
  { key: "totalChatSessions", label: "Chat sessions" },
  { key: "aiCreditsUsedTotal", label: "AI credits used" },
  { key: "apolloCreditsUsedTotal", label: "Apollo credits used" },
];

function WaitlistStatusPill({ status }: { status: OversightWaitlistRow["status"] }) {
  const styles: Record<OversightWaitlistRow["status"], string> = {
    pending: "bg-[var(--paper)] text-[var(--muted)]",
    allowed: "bg-[var(--signal-soft)] text-[var(--signal-deep)]",
    blocked: "bg-[#fef2f2] text-[var(--danger)]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export default function OversightPage() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [summary, setSummary] = useState<OversightSummary | null>(null);
  const [users, setUsers] = useState<OversightUserRow[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [waitlist, setWaitlist] = useState<OversightWaitlistRow[]>([]);
  const [error, setError] = useState("");
  const [, startLoadTransition] = useTransition();

  const [allowFormId, setAllowFormId] = useState<string | null>(null);
  const [allowDrafts, setAllowDrafts] = useState<Record<string, { apollo: string; ai: string }>>({});
  const [busyWaitlistId, setBusyWaitlistId] = useState<string | null>(null);
  const [waitlistError, setWaitlistError] = useState("");
  const [waitlistNotice, setWaitlistNotice] = useState<{ id: string; message: string } | null>(null);

  const load = useCallback(() => {
    startLoadTransition(async () => {
      setError("");
      try {
        const [summaryRes, usersRes, activityRes, waitlistRes] = await Promise.all([
          fetch("/api/oversight/summary"),
          fetch("/api/oversight/users"),
          fetch("/api/oversight/activity"),
          fetch("/api/oversight/waitlist"),
        ]);

        if (summaryRes.status === 403) {
          setAuthState("denied");
          return;
        }

        const [summaryData, usersData, activityData, waitlistData] = await Promise.all([
          summaryRes.json(),
          usersRes.json(),
          activityRes.json(),
          waitlistRes.json(),
        ]);

        if (!summaryRes.ok || !usersRes.ok || !activityRes.ok || !waitlistRes.ok) {
          setError(
            summaryData.error ?? usersData.error ?? activityData.error ?? waitlistData.error ?? "Failed to load Oversight",
          );
          setAuthState("allowed");
          return;
        }

        setSummary(summaryData.summary as OversightSummary);
        setUsers(usersData.users as OversightUserRow[]);
        setEvents(activityData.events as ActivityEvent[]);
        setWaitlist(waitlistData.waitlist as OversightWaitlistRow[]);
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

  function openAllowForm(row: OversightWaitlistRow) {
    setWaitlistNotice(null);
    setWaitlistError("");
    setAllowDrafts((prev) => ({
      ...prev,
      [row.id]: prev[row.id] ?? { apollo: WAITLIST_DEFAULT_APOLLO_LIMIT, ai: WAITLIST_DEFAULT_AI_LIMIT },
    }));
    setAllowFormId(row.id);
  }

  function cancelAllowForm() {
    setAllowFormId(null);
  }

  async function confirmAllow(row: OversightWaitlistRow) {
    const draft = allowDrafts[row.id] ?? { apollo: WAITLIST_DEFAULT_APOLLO_LIMIT, ai: WAITLIST_DEFAULT_AI_LIMIT };
    setBusyWaitlistId(row.id);
    setWaitlistError("");
    try {
      const response = await fetch(`/api/oversight/waitlist/${row.id}/allow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apolloCreditLimit: draft.apollo.trim() ? Number(draft.apollo) : null,
          aiCreditLimit: draft.ai.trim() ? Number(draft.ai) : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setWaitlistError(data.error ?? "Failed to allow this signup");
        return;
      }
      setAllowFormId(null);
      setWaitlistNotice({
        id: row.id,
        message: data.alreadyHasAccount
          ? "Already has an account — marked allowed."
          : data.emailSent
            ? "Allowed — invite emailed."
            : "Allowed — invite created (email not sent; share the link from Team settings).",
      });
      load();
    } catch {
      setWaitlistError("Failed to allow this signup. Check your connection and try again.");
    } finally {
      setBusyWaitlistId(null);
    }
  }

  async function handleBlock(row: OversightWaitlistRow) {
    if (!window.confirm(`Block ${row.email}? They won't be invited.`)) return;
    setBusyWaitlistId(row.id);
    setWaitlistError("");
    setWaitlistNotice(null);
    try {
      const response = await fetch(`/api/oversight/waitlist/${row.id}/block`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setWaitlistError(data.error ?? "Failed to block this signup");
        return;
      }
      load();
    } catch {
      setWaitlistError("Failed to block this signup. Check your connection and try again.");
    } finally {
      setBusyWaitlistId(null);
    }
  }

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
        <h2 className="text-sm font-semibold text-[var(--ink)]">Waitlist</h2>
        {waitlistError ? <p className="lf-alert lf-alert-error">{waitlistError}</p> : null}
        {waitlist.length === 0 ? (
          <div className="lf-card px-6 py-4">
            <p className="text-sm text-[var(--muted)]">No waitlist signups yet.</p>
          </div>
        ) : (
          <div className="lf-table-wrap">
            <table className="lf-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Use case</th>
                  <th>Signed up</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {waitlist.map((row) => (
                  <Fragment key={row.id}>
                    <tr>
                      <td className="font-medium text-[var(--ink)]">{row.name}</td>
                      <td>{row.email}</td>
                      <td className="max-w-xs">
                        <span className="line-clamp-2 text-[var(--ink-soft)]">{row.useCase || "—"}</span>
                      </td>
                      <td title={new Date(row.createdAt).toLocaleString()}>{formatRelativeTime(row.createdAt)}</td>
                      <td>
                        <WaitlistStatusPill status={row.status} />
                      </td>
                      <td>
                        {row.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openAllowForm(row)}
                              disabled={busyWaitlistId === row.id}
                              className="lf-btn lf-btn-primary !px-3 !py-1.5 text-xs"
                            >
                              Allow
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBlock(row)}
                              disabled={busyWaitlistId === row.id}
                              className="lf-btn lf-btn-ghost !px-3 !py-1.5 text-xs text-[var(--danger)]"
                            >
                              {busyWaitlistId === row.id ? "Working…" : "Block"}
                            </button>
                          </div>
                        ) : waitlistNotice?.id === row.id ? (
                          <p className="text-right text-xs text-[var(--signal-deep)]">{waitlistNotice.message}</p>
                        ) : null}
                      </td>
                    </tr>
                    {allowFormId === row.id ? (
                      <tr>
                        <td colSpan={6} className="bg-[var(--paper)]">
                          <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-end sm:flex-wrap">
                            <label className="lf-label basis-40">
                              Apollo credit limit
                              <input
                                type="number"
                                min={0}
                                value={allowDrafts[row.id]?.apollo ?? ""}
                                onChange={(event) =>
                                  setAllowDrafts((prev) => ({
                                    ...prev,
                                    [row.id]: { ...prev[row.id], apollo: event.target.value },
                                  }))
                                }
                                placeholder="Unlimited"
                                className="lf-input !py-1.5 text-sm"
                              />
                            </label>
                            <label className="lf-label basis-40">
                              AI credit limit
                              <input
                                type="number"
                                min={0}
                                value={allowDrafts[row.id]?.ai ?? ""}
                                onChange={(event) =>
                                  setAllowDrafts((prev) => ({
                                    ...prev,
                                    [row.id]: { ...prev[row.id], ai: event.target.value },
                                  }))
                                }
                                placeholder="Unlimited"
                                className="lf-input !py-1.5 text-sm"
                              />
                            </label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => confirmAllow(row)}
                                disabled={busyWaitlistId === row.id}
                                className="lf-btn lf-btn-primary !px-3 !py-1.5 text-xs"
                              >
                                {busyWaitlistId === row.id ? "Inviting…" : "Confirm & invite"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelAllowForm}
                                disabled={busyWaitlistId === row.id}
                                className="lf-btn lf-btn-ghost !px-3 !py-1.5 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Activity</h2>
        <div className="lf-card px-4 py-1 sm:px-6">
          <OversightActivityFeed events={events} />
        </div>
      </section>
    </div>
  );
}
