"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { INBOX_CATEGORIES, categoryLabel, type InboxCategoryValue } from "@/lib/inbox-category";
import { InboxList, type InboxMessageRow } from "@/components/inbox-list";

type Stats = {
  sent: number;
  opened: number;
  replied: number;
  interested: number;
  booked: number;
  notInterested: number;
};

const STAT_ITEMS: { key: keyof Stats; label: string }[] = [
  { key: "sent", label: "Sent" },
  { key: "opened", label: "Opened" },
  { key: "replied", label: "Replied" },
  { key: "interested", label: "Interested" },
  { key: "booked", label: "Booked" },
  { key: "notInterested", label: "Not interested" },
];

export default function InboxPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [messages, setMessages] = useState<InboxMessageRow[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<InboxCategoryValue | "all">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [error, setError] = useState("");
  const [loading, startLoadTransition] = useTransition();
  const [, startStatsTransition] = useTransition();
  const [simulating, setSimulating] = useState(false);
  const [addingToCalendarId, setAddingToCalendarId] = useState<string | null>(null);
  const [calendarNote, setCalendarNote] = useState("");

  const fetchStats = useCallback(() => {
    startStatsTransition(async () => {
      try {
        const response = await fetch("/api/inbox/stats");
        const data = await response.json();
        if (response.ok) setStats(data as Stats);
      } catch {
        // Stats are supplementary — a failed fetch just leaves the strip blank.
      }
    });
  }, [startStatsTransition]);

  const fetchMessages = useCallback(() => {
    startLoadTransition(async () => {
      setError("");
      try {
        const params = new URLSearchParams();
        if (categoryFilter !== "all") params.set("category", categoryFilter);
        if (unreadOnly) params.set("unread", "1");
        const response = await fetch(`/api/inbox?${params.toString()}`);
        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "Failed to load inbox");
          return;
        }
        setMessages(data.messages as InboxMessageRow[]);
      } catch {
        setError("Failed to load inbox. Check your connection and try again.");
      }
    });
  }, [categoryFilter, unreadOnly]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  async function handleMarkRead(id: string, read: boolean) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, readAt: read ? new Date().toISOString() : null } : m)));
    try {
      await fetch(`/api/inbox/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read }),
      });
    } catch {
      // Optimistic update already applied; a background refresh will reconcile.
    }
  }

  async function handleChangeCategory(id: string, category: InboxCategoryValue) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, category, categorySource: "manual" } : m)));
    try {
      const response = await fetch(`/api/inbox/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      if (response.ok) fetchStats();
    } catch {
      // Optimistic update already applied.
    }
  }

  async function handleAddToCalendar(message: InboxMessageRow) {
    setAddingToCalendarId(message.id);
    setCalendarNote("");
    try {
      const response = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Call: ${message.leadName ?? message.fromEmail}`,
          startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          description: message.bodyText ?? undefined,
          inboxMessageId: message.id,
        }),
      });
      if (response.ok) {
        setCalendarNote("Added a placeholder event to Calendar — open it to set the exact time.");
      } else {
        const data = await response.json();
        setCalendarNote(data.error ?? "Failed to add to calendar");
      }
    } catch {
      setCalendarNote("Failed to add to calendar. Check your connection and try again.");
    } finally {
      setAddingToCalendarId(null);
    }
  }

  async function handleSimulateReply() {
    setSimulating(true);
    setError("");
    try {
      const response = await fetch("/api/inbox/simulate-reply", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to simulate a reply");
        return;
      }
      fetchMessages();
      fetchStats();
    } catch {
      setError("Failed to simulate a reply. Check your connection and try again.");
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-5 py-6 sm:gap-6 sm:px-8 sm:py-8">
      <div className="lf-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="lf-chip">Replies</p>
          <h1 className="lf-display mt-2 text-3xl font-semibold text-[var(--ink)]">Inbox</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Replies to your campaigns, categorized automatically by AI.
          </p>
        </div>
        <button type="button" onClick={handleSimulateReply} disabled={simulating} className="lf-btn lf-btn-ghost">
          {simulating ? "Simulating…" : "Simulate a reply"}
        </button>
      </div>

      {stats ? (
        <div className="lf-card grid grid-cols-2 gap-px overflow-hidden sm:grid-cols-3 lg:grid-cols-6">
          {STAT_ITEMS.map((item) => (
            <div key={item.key} className="flex flex-col gap-1 bg-[var(--paper-elevated)] px-4 py-4">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{item.label}</span>
              <span className="lf-display text-2xl font-semibold text-[var(--ink)]">{stats[item.key]}</span>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="lf-alert lf-alert-error">{error}</p> : null}
      {calendarNote ? <p className="lf-alert lf-alert-ok">{calendarNote}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCategoryFilter("all")}
          className={categoryFilter === "all" ? "lf-btn lf-btn-primary !px-3 !py-1.5 text-xs" : "lf-btn lf-btn-ghost !px-3 !py-1.5 text-xs"}
        >
          All
        </button>
        {INBOX_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setCategoryFilter(category)}
            className={categoryFilter === category ? "lf-btn lf-btn-primary !px-3 !py-1.5 text-xs" : "lf-btn lf-btn-ghost !px-3 !py-1.5 text-xs"}
          >
            {categoryLabel(category)}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-[var(--ink-soft)]">
          <input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />
          Unread only
        </label>
      </div>

      <InboxList
        messages={messages}
        loading={loading}
        onMarkRead={handleMarkRead}
        onChangeCategory={handleChangeCategory}
        onAddToCalendar={handleAddToCalendar}
        addingToCalendarId={addingToCalendarId}
      />
    </div>
  );
}
