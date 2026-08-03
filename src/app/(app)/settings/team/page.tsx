"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { ApolloUsage } from "@/lib/apollo";

type UserSummary = {
  id: string;
  email: string;
  name: string | null;
  role: "owner" | "member";
  apolloCreditLimit: number | null;
  apolloCreditsUsed: number;
  aiCreditLimit: number | null;
  aiCreditsUsed: number;
  invitedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
};

type InviteSummary = {
  id: string;
  email: string;
  apolloCreditLimit: number | null;
  aiCreditLimit: number | null;
  expiresAt: string;
  expired: boolean;
  createdAt: string;
};

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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/** Apollo's real account-level remaining credits — for the APP_PASSWORD-authenticated account, which has no app-tracked AI credit pool. */
function AdminApolloCredits() {
  const [state, setState] = useState<
    { status: "loading" } | { status: "ready"; usage: ApolloUsage } | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/apollo/usage");
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setState({ status: "error", message: data.error ?? "Apollo usage unavailable" });
          return;
        }
        setState({ status: "ready", usage: data as ApolloUsage });
      } catch {
        if (!cancelled) setState({ status: "error", message: "Apollo usage unavailable" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <p className="text-sm text-[var(--muted)]">Loading Apollo credits…</p>;
  }

  if (state.status === "error") {
    return <p className="text-sm text-[var(--ink-soft)]">Apollo credits aren&apos;t available right now.</p>;
  }

  if (state.usage.buckets.length === 0) {
    return <p className="text-sm text-[var(--ink-soft)]">Apollo returned no credit breakdown for this account.</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {state.usage.buckets.map((bucket) => (
        <li key={bucket.label} className="flex items-center justify-between gap-3">
          <span className="text-[var(--ink-soft)]">{bucket.label}</span>
          <span className="font-medium text-[var(--ink)]">
            {formatNumber(bucket.remaining)} / {formatNumber(bucket.allowance)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MyCreditsCard({ user }: { user: UserSummary }) {
  return (
    <div className="lf-card p-6">
      <h2 className="mb-1 text-sm font-semibold text-[var(--ink)]">Your credits</h2>
      <p className="mb-4 text-xs text-[var(--muted)]">Signed in as {user.email}</p>
      {user.role === "owner" ? (
        <AdminApolloCredits />
      ) : (
        <div className="flex flex-col gap-4">
          <CreditBar label="Apollo credits" used={user.apolloCreditsUsed} limit={user.apolloCreditLimit} />
          <CreditBar label="AI credits" used={user.aiCreditsUsed} limit={user.aiCreditLimit} />
        </div>
      )}
    </div>
  );
}

function LimitInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Unlimited"
      className="lf-input !py-1.5 text-sm"
    />
  );
}

export default function TeamSettingsPage() {
  const [me, setMe] = useState<UserSummary | null>(null);
  const [members, setMembers] = useState<UserSummary[]>([]);
  const [invites, setInvites] = useState<InviteSummary[]>([]);
  const [loading, startLoadTransition] = useTransition();
  const [loadError, setLoadError] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteApolloLimit, setInviteApolloLimit] = useState("");
  const [inviteAiLimit, setInviteAiLimit] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteLink, setInviteLink] = useState<{ email: string; link: string; emailSent: boolean } | null>(null);

  const [editingLimits, setEditingLimits] = useState<Record<string, { apollo: string; ai: string }>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [rescindingId, setRescindingId] = useState<string | null>(null);

  const load = useCallback(() => {
    startLoadTransition(async () => {
      setLoadError("");
      try {
        const meResponse = await fetch("/api/team/me");
        const meData = await meResponse.json();
        if (!meResponse.ok) {
          setLoadError(meData.error ?? "Failed to load your account");
          return;
        }
        setMe(meData.user as UserSummary);

        if (meData.user.role === "owner") {
          const teamResponse = await fetch("/api/team");
          const teamData = await teamResponse.json();
          if (!teamResponse.ok) {
            setLoadError(teamData.error ?? "Failed to load team");
            return;
          }
          setMembers(teamData.members as UserSummary[]);
          setInvites(teamData.invites as InviteSummary[]);
        }
      } catch {
        setLoadError("Failed to load team. Check your connection and try again.");
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setInviteError("");
    setInviteLink(null);
    try {
      const response = await fetch("/api/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          apolloCreditLimit: inviteApolloLimit.trim() ? Number(inviteApolloLimit) : null,
          aiCreditLimit: inviteAiLimit.trim() ? Number(inviteAiLimit) : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setInviteError(data.error ?? "Failed to send invite");
        return;
      }
      setInviteLink({ email: inviteEmail.trim(), link: data.link, emailSent: data.emailSent });
      setInviteEmail("");
      setInviteApolloLimit("");
      setInviteAiLimit("");
      load();
    } catch {
      setInviteError("Failed to send invite. Check your connection and try again.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRescind(id: string) {
    if (!window.confirm("Rescind this invite? The link will stop working.")) return;
    setRescindingId(id);
    try {
      const response = await fetch(`/api/team/invites/${id}`, { method: "DELETE" });
      if (response.ok) load();
    } finally {
      setRescindingId(null);
    }
  }

  function startEditing(user: UserSummary) {
    setEditingLimits((prev) => ({
      ...prev,
      [user.id]: {
        apollo: user.apolloCreditLimit === null ? "" : String(user.apolloCreditLimit),
        ai: user.aiCreditLimit === null ? "" : String(user.aiCreditLimit),
      },
    }));
  }

  async function handleSaveLimits(userId: string) {
    const draft = editingLimits[userId];
    if (!draft) return;
    setSavingUserId(userId);
    try {
      const response = await fetch(`/api/team/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apolloCreditLimit: draft.apollo.trim() ? Number(draft.apollo) : null,
          aiCreditLimit: draft.ai.trim() ? Number(draft.ai) : null,
        }),
      });
      if (response.ok) {
        setEditingLimits((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
        load();
      }
    } finally {
      setSavingUserId(null);
    }
  }

  const isOwner = me?.role === "owner";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 py-6 sm:gap-6 sm:px-8 sm:py-8">
      <div className="lf-rise">
        <p className="lf-chip">Team</p>
        <h1 className="lf-display mt-2 text-3xl font-semibold text-[var(--ink)]">Team</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {isOwner
            ? "Invite teammates and set their Apollo and AI credit limits."
            : "Your Apollo and AI credit limits."}
        </p>
      </div>

      {loadError ? <p className="lf-alert lf-alert-error">{loadError}</p> : null}
      {loading && !me ? <p className="text-sm text-[var(--muted)]">Loading…</p> : null}

      {me ? <MyCreditsCard user={me} /> : null}

      {isOwner ? (
        <>
          <div className="lf-card p-6">
            <h2 className="mb-4 text-sm font-semibold text-[var(--ink)]">Invite a teammate</h2>
            <form onSubmit={handleInvite} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
              <label className="lf-label flex-1 basis-56">
                Email
                <input
                  type="email"
                  value={inviteEmail}
                  disabled={inviting}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="teammate@company.com"
                  className="lf-input"
                  required
                />
              </label>
              <label className="lf-label basis-40">
                Apollo credit limit
                <LimitInput value={inviteApolloLimit} onChange={setInviteApolloLimit} disabled={inviting} />
              </label>
              <label className="lf-label basis-40">
                AI credit limit
                <LimitInput value={inviteAiLimit} onChange={setInviteAiLimit} disabled={inviting} />
              </label>
              <button type="submit" disabled={inviting || !inviteEmail.trim()} className="lf-btn lf-btn-primary">
                {inviting ? "Sending…" : "Send invite"}
              </button>
            </form>
            {inviteError ? <p className="lf-alert lf-alert-error mt-4">{inviteError}</p> : null}
            {inviteLink ? (
              <div className="lf-alert lf-alert-info mt-4 flex flex-col gap-2">
                <p>
                  Invite created for <span className="font-medium">{inviteLink.email}</span>
                  {inviteLink.emailSent ? " — email sent." : " — email not sent (Resend not configured); share this link instead:"}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-[var(--paper)] px-2 py-1 text-xs text-[var(--ink)]">
                    {inviteLink.link}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(inviteLink.link)}
                    className="lf-btn lf-btn-ghost !px-3 !py-1.5 text-xs"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="lf-card overflow-hidden">
            <div className="border-b border-[var(--line)] px-6 py-3">
              <h2 className="text-sm font-semibold text-[var(--ink)]">People</h2>
            </div>
            {members.length === 0 ? (
              <p className="px-6 py-4 text-sm text-[var(--muted)]">No one yet.</p>
            ) : (
              <div className="lf-table-wrap !rounded-none !border-0 !shadow-none">
                <table className="lf-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Apollo credits</th>
                      <th>AI credits</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => {
                      const editing = editingLimits[member.id];
                      return (
                        <tr key={member.id}>
                          <td>
                            <div className="font-medium text-[var(--ink)]">{member.name || member.email}</div>
                            {member.name ? <div className="text-xs text-[var(--muted)]">{member.email}</div> : null}
                          </td>
                          <td>
                            {editing ? (
                              <LimitInput
                                value={editing.apollo}
                                onChange={(value) =>
                                  setEditingLimits((prev) => ({ ...prev, [member.id]: { ...prev[member.id], apollo: value } }))
                                }
                              />
                            ) : (
                              formatLimit(member.apolloCreditsUsed, member.apolloCreditLimit)
                            )}
                          </td>
                          <td>
                            {member.role === "owner" ? (
                              "—"
                            ) : editing ? (
                              <LimitInput
                                value={editing.ai}
                                onChange={(value) =>
                                  setEditingLimits((prev) => ({ ...prev, [member.id]: { ...prev[member.id], ai: value } }))
                                }
                              />
                            ) : (
                              formatLimit(member.aiCreditsUsed, member.aiCreditLimit)
                            )}
                          </td>
                          <td>
                            <div className="flex justify-end gap-2">
                              {editing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveLimits(member.id)}
                                    disabled={savingUserId === member.id}
                                    className="lf-btn lf-btn-primary !px-3 !py-1.5 text-xs"
                                  >
                                    {savingUserId === member.id ? "Saving…" : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingLimits((prev) => {
                                        const next = { ...prev };
                                        delete next[member.id];
                                        return next;
                                      })
                                    }
                                    className="lf-btn lf-btn-ghost !px-3 !py-1.5 text-xs"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : member.role === "owner" ? (
                                <span className="text-xs text-[var(--muted)]">Unlimited</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEditing(member)}
                                  className="lf-btn lf-btn-ghost !px-3 !py-1.5 text-xs"
                                >
                                  Edit limits
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="lf-card overflow-hidden">
            <div className="border-b border-[var(--line)] px-6 py-3">
              <h2 className="text-sm font-semibold text-[var(--ink)]">Pending invites</h2>
            </div>
            {invites.length === 0 ? (
              <p className="px-6 py-4 text-sm text-[var(--muted)]">No pending invites.</p>
            ) : (
              <div className="lf-table-wrap !rounded-none !border-0 !shadow-none">
                <table className="lf-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Apollo limit</th>
                      <th>AI limit</th>
                      <th>Expires</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((invite) => (
                      <tr key={invite.id}>
                        <td className="font-medium text-[var(--ink)]">{invite.email}</td>
                        <td>{invite.apolloCreditLimit ?? "Unlimited"}</td>
                        <td>{invite.aiCreditLimit ?? "Unlimited"}</td>
                        <td className={invite.expired ? "text-[var(--danger)]" : undefined}>
                          {invite.expired ? "Expired" : new Date(invite.expiresAt).toLocaleDateString()}
                        </td>
                        <td>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRescind(invite.id)}
                              disabled={rescindingId === invite.id}
                              className="lf-btn lf-btn-ghost !px-3 !py-1.5 text-xs text-[var(--danger)]"
                            >
                              {rescindingId === invite.id ? "Rescinding…" : "Rescind"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
