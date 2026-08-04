"use client";

import { useState } from "react";
import { INBOX_CATEGORIES, categoryLabel, type InboxCategoryValue } from "@/lib/inbox-category";
import { InboxCategoryBadge } from "@/components/inbox-category-badge";
import { LoadingOverlay } from "@/components/loading-overlay";

export type InboxMessageRow = {
  id: string;
  fromEmail: string;
  toEmail: string | null;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  category: InboxCategoryValue;
  categoryConfidence: number | null;
  categorySource: string;
  receivedAt: string;
  readAt: string | null;
  leadName: string | null;
  leadCompany: string | null;
  campaign: { id: string; name: string } | null;
};

type InboxListProps = {
  messages: InboxMessageRow[];
  loading: boolean;
  onMarkRead: (id: string, read: boolean) => void;
  onChangeCategory: (id: string, category: InboxCategoryValue) => void;
  onAddToCalendar: (message: InboxMessageRow) => void;
  addingToCalendarId: string | null;
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function InboxList({
  messages,
  loading,
  onMarkRead,
  onChangeCategory,
  onAddToCalendar,
  addingToCalendarId,
}: InboxListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggle(message: InboxMessageRow) {
    const next = expandedId === message.id ? null : message.id;
    setExpandedId(next);
    if (next && !message.readAt) onMarkRead(message.id, true);
  }

  if (loading) {
    return (
      <div className="relative min-h-[220px]">
        <LoadingOverlay label="Loading inbox…" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="lf-card flex flex-col items-center gap-1 px-6 py-12 text-center">
        <p className="text-sm font-medium text-[var(--ink)]">No replies yet</p>
        <p className="text-sm text-[var(--muted)]">
          Replies to your campaign sends will show up here, categorized automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="lf-card flex flex-col divide-y divide-[var(--line)] overflow-hidden">
      {messages.map((message) => {
        const isExpanded = expandedId === message.id;
        const isUnread = !message.readAt;
        const who = message.leadName ?? message.fromEmail;

        return (
          <div key={message.id} className={isUnread ? "bg-[color-mix(in_srgb,var(--signal-soft)_25%,transparent)]" : ""}>
            <button
              type="button"
              onClick={() => toggle(message)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${isUnread ? "bg-[var(--signal)]" : "bg-transparent"}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`truncate text-sm ${isUnread ? "font-semibold text-[var(--ink)]" : "font-medium text-[var(--ink-soft)]"}`}>
                    {who}
                  </span>
                  {message.leadCompany ? (
                    <span className="hidden shrink-0 text-xs text-[var(--muted)] sm:inline">{message.leadCompany}</span>
                  ) : null}
                </div>
                <p className="truncate text-sm text-[var(--muted)]">{message.subject ?? "(no subject)"}</p>
              </div>
              <InboxCategoryBadge category={message.category} />
              <span className="w-14 shrink-0 text-right text-xs text-[var(--muted)]">{formatWhen(message.receivedAt)}</span>
            </button>

            {isExpanded ? (
              <div className="flex flex-col gap-4 border-t border-[var(--line)] bg-white/60 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]">
                  <span>
                    From <span className="font-medium text-[var(--ink-soft)]">{message.fromEmail}</span>
                    {message.toEmail ? <> to {message.toEmail}</> : null}
                    {message.campaign ? <> · Campaign: {message.campaign.name}</> : null}
                  </span>
                  <span>{new Date(message.receivedAt).toLocaleString()}</span>
                </div>

                <p className="whitespace-pre-wrap text-sm text-[var(--ink)]">
                  {message.bodyText || "(no message body)"}
                </p>

                <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-3">
                  <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    Category
                    <select
                      value={message.category}
                      onChange={(event) => onChangeCategory(message.id, event.target.value as InboxCategoryValue)}
                      className="lf-input !w-auto !py-1.5 text-xs"
                    >
                      {INBOX_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {categoryLabel(category)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {message.categorySource !== "manual" && message.categoryConfidence != null ? (
                    <span className="text-xs text-[var(--muted)]">
                      AI confidence: {Math.round(message.categoryConfidence * 100)}%
                    </span>
                  ) : null}

                  <div className="ml-auto flex items-center gap-2">
                    {message.category === "booked" ? (
                      <button
                        type="button"
                        onClick={() => onAddToCalendar(message)}
                        disabled={addingToCalendarId === message.id}
                        className="lf-btn lf-btn-ghost !px-3 !py-1.5 text-xs"
                      >
                        {addingToCalendarId === message.id ? "Adding…" : "Add to calendar"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onMarkRead(message.id, Boolean(message.readAt))}
                      className="lf-btn lf-btn-ghost !px-3 !py-1.5 text-xs"
                    >
                      {message.readAt ? "Mark unread" : "Mark read"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
