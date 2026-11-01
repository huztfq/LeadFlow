"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

type Status = {
  configured: boolean;
  campaign?: { id: number; name: string; status: string } | null;
  leads?: number;
  mailboxesAttached?: number;
  mailboxesTotal?: number;
  warmingUp?: number;
  repliesConnected?: boolean;
  ready?: { A: number; AB: number };
  error?: string;
};

type PushResult = { pushed: number; skipped: number; remaining: number; error?: string };

const SEGMENTS = [
  { value: "", label: "All segments" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "local_service", label: "Local service" },
];

/**
 * Cold sending through Smartlead: push leads (picked on the Leads page, or the
 * graded HubSpot audience) with their finished copy, then start/pause there.
 */
export function SmartleadPanel({
  campaignId,
  campaignStatus,
  selectedLeadIds,
  onPushed,
}: {
  campaignId: string;
  campaignStatus: string;
  selectedLeadIds: string[];
  onPushed?: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [grades, setGrades] = useState<"A" | "AB">("A");
  const [segment, setSegment] = useState("");
  const [limit, setLimit] = useState(50);
  const [busy, setBusy] = useState<"" | "push" | "start" | "pause">("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [, startLoad] = useTransition();

  const load = useCallback(() => {
    startLoad(async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/smartlead`);
        const data = (await res.json()) as Status;
        if (!res.ok) setError(data.error ?? "Couldn't reach Smartlead");
        setStatus(data);
      } catch {
        setError("Couldn't reach Smartlead. Check your connection and try again.");
      }
    });
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: unknown) {
    const res = await fetch(`/api/campaigns/${campaignId}/smartlead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Smartlead request failed");
    return data;
  }

  async function push(source: { leadIds: string[] } | { audience: { grades: string[]; segment: string | null } }, max: number) {
    setBusy("push");
    setError("");
    setMessage("");
    let pushed = 0;
    let skipped = 0;
    try {
      // Each request stops at its time budget; keep going until done or the limit is reached.
      for (let round = 0; round < 20; round++) {
        const result = (await post({ action: "push", ...source, limit: Math.max(1, max - pushed - skipped) })) as PushResult;
        pushed += result.pushed;
        skipped += result.skipped;
        setMessage(`Pushed ${pushed} so far…`);
        if (result.remaining === 0 || pushed + skipped >= max || result.pushed + result.skipped === 0) break;
      }
      setMessage(
        `Pushed ${pushed} lead${pushed === 1 ? "" : "s"} to Smartlead` +
          (skipped ? ` (${skipped} refused there as invalid, blocked or duplicate)` : "") +
          ".",
      );
      onPushed?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push failed");
      if (pushed) setMessage(`Pushed ${pushed} before the error.`);
    } finally {
      setBusy("");
      load();
    }
  }

  async function control(action: "start" | "pause") {
    setBusy(action);
    setError("");
    setMessage("");
    try {
      await post({ action });
      setMessage(action === "start" ? "Sending started in Smartlead." : "Paused in Smartlead.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy("");
      load();
    }
  }

  if (status && !status.configured) {
    return (
      <div className="lf-card flex flex-col gap-2 p-6">
        <h2 className="lf-display text-xl font-semibold text-[var(--ink)]">Send with Smartlead</h2>
        <p className="text-sm text-[var(--muted)]">Set SMARTLEAD_API_KEY to send cold campaigns from your own warmed mailboxes.</p>
      </div>
    );
  }

  const sl = status?.campaign ?? null;
  const running = sl?.status === "ACTIVE";
  const leadflowSending = campaignStatus === "active";
  const ready = grades === "A" ? status?.ready?.A ?? 0 : status?.ready?.AB ?? 0;

  return (
    <div className="lf-card flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="lf-display text-xl font-semibold text-[var(--ink)]">Send with Smartlead</h2>
        {sl ? <span className="lf-chip">{sl.status.toLowerCase()}</span> : null}
        {sl && sl.status !== "ACTIVE" ? (
          <button
            type="button"
            onClick={() => control("start")}
            disabled={Boolean(busy) || !status?.mailboxesAttached}
            className="lf-btn lf-btn-primary !px-3 !py-1 text-xs"
            title={status?.mailboxesAttached ? "" : "Connect a mailbox in Smartlead first"}
          >
            {busy === "start" ? "Starting…" : "Start sending"}
          </button>
        ) : null}
        {running ? (
          <button type="button" onClick={() => control("pause")} disabled={Boolean(busy)} className="lf-btn lf-btn-ghost !px-3 !py-1 text-xs">
            {busy === "pause" ? "Pausing…" : "Pause"}
          </button>
        ) : null}
      </div>

      {status ? (
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Leads in Smartlead</dt>
            <dd className="font-semibold text-[var(--ink)]">{status.leads ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Mailboxes</dt>
            <dd className="font-semibold text-[var(--ink)]">
              {status.mailboxesAttached ?? 0} attached / {status.mailboxesTotal ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Warming up</dt>
            <dd className="font-semibold text-[var(--ink)]">{status.warmingUp ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Replies to inbox</dt>
            <dd className="font-semibold text-[var(--ink)]">{status.repliesConnected ? "Connected" : "Not set up"}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-[var(--muted)]">Checking Smartlead…</p>
      )}

      {status && status.mailboxesTotal === 0 ? (
        <p className="lf-alert lf-alert-warn">
          No mailboxes in Smartlead yet. You can push leads now; connect and warm mailboxes (2–3 weeks) before starting.
        </p>
      ) : null}
      {leadflowSending ? (
        <p className="lf-alert lf-alert-warn">This campaign is sending through Leadflow. Pause it here before using Smartlead.</p>
      ) : null}

      {selectedLeadIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-[var(--ink)]">
            {selectedLeadIds.length} lead{selectedLeadIds.length === 1 ? "" : "s"} selected on the Leads page.
          </span>
          <button
            type="button"
            onClick={() => push({ leadIds: selectedLeadIds }, selectedLeadIds.length)}
            disabled={Boolean(busy) || leadflowSending}
            className="lf-btn lf-btn-primary !px-3 !py-1.5 text-xs"
          >
            {busy === "push" ? "Pushing…" : "Push selected to Smartlead"}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          HubSpot audience
          <select value={grades} onChange={(e) => setGrades(e.target.value as "A" | "AB")} className="lf-input !py-1.5 text-sm">
            <option value="A">Grade A</option>
            <option value="AB">Grades A + B</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          Segment
          <select value={segment} onChange={(e) => setSegment(e.target.value)} className="lf-input !py-1.5 text-sm">
            {SEGMENTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
          How many
          <input
            type="number"
            min={1}
            max={500}
            value={limit}
            onChange={(e) => setLimit(Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
            className="lf-input w-24 !py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => push({ audience: { grades: grades === "A" ? ["A"] : ["A", "B"], segment: segment || null } }, limit)}
          disabled={Boolean(busy) || leadflowSending || ready === 0}
          className="lf-btn lf-btn-ghost !px-3 !py-1.5 text-xs"
        >
          {busy === "push" ? "Pushing…" : `Push up to ${limit}`}
        </button>
        <span className="text-xs text-[var(--muted)]">{ready} ready (all segments)</span>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Each lead&apos;s email is written when it&apos;s pushed (AI opener included), so later step edits only apply to leads pushed after them.
        Smartlead sends; Leadflow doesn&apos;t send this campaign itself. Replies land in the Inbox.
      </p>

      {error ? <p className="lf-alert lf-alert-error">{error}</p> : null}
      {message ? <p className="lf-alert lf-alert-ok">{message}</p> : null}
    </div>
  );
}
