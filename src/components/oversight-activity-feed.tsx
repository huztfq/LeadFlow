"use client";

import type { ActivityEvent } from "@/lib/oversight";
import { formatRelativeTime } from "@/lib/format-time";

function eventDotClass(type: ActivityEvent["type"]): string {
  switch (type) {
    case "user_joined":
    case "invite_accepted":
      return "bg-[var(--signal)]";
    case "invite_sent":
      return "bg-amber-400";
    case "email_sent":
      return "bg-blue-400";
    case "inbox_reply":
      return "bg-purple-400";
    case "chat_session":
    default:
      return "bg-[var(--muted)]";
  }
}

export function OversightActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No activity yet.</p>;
  }

  return (
    <ul className="flex flex-col">
      {events.map((event, index) => (
        <li
          key={event.id}
          className={`flex items-start gap-3 py-3 ${index === 0 ? "" : "border-t border-[var(--line)]"}`}
        >
          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${eventDotClass(event.type)}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[var(--ink)]">{event.title}</p>
            {event.detail ? <p className="mt-0.5 text-xs text-[var(--muted)]">{event.detail}</p> : null}
          </div>
          <time dateTime={event.at} className="shrink-0 text-xs text-[var(--muted)]" title={new Date(event.at).toLocaleString()}>
            {formatRelativeTime(event.at)}
          </time>
        </li>
      ))}
    </ul>
  );
}
