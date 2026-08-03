export type AgendaEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string | null;
  source: "google" | "ical" | "manual";
};

function sourceBadgeClass(source: AgendaEvent["source"]): string {
  switch (source) {
    case "google":
      return "bg-blue-50 text-blue-800";
    case "ical":
      return "bg-[var(--signal-soft)] text-[var(--signal-deep)]";
    case "manual":
    default:
      return "bg-amber-50 text-amber-900";
  }
}

function sourceLabel(source: AgendaEvent["source"]): string {
  switch (source) {
    case "google":
      return "Google";
    case "ical":
      return "iCal";
    case "manual":
    default:
      return "Manual";
  }
}

function formatRange(start: string, end: string | null): string {
  const startDate = new Date(start);
  const dayLabel = startDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const timeLabel = startDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (!end) return `${dayLabel} · ${timeLabel}`;
  const endTime = new Date(end).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dayLabel} · ${timeLabel} – ${endTime}`;
}

export function CalendarAgenda({ events }: { events: AgendaEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="lf-card flex flex-col items-center gap-1 px-6 py-12 text-center">
        <p className="text-sm font-medium text-[var(--ink)]">No upcoming events</p>
        <p className="text-sm text-[var(--muted)]">
          Connect a calendar above, or add an event from a &quot;booked&quot; inbox reply.
        </p>
      </div>
    );
  }

  return (
    <div className="lf-card flex flex-col divide-y divide-[var(--line)] overflow-hidden">
      {events.map((event) => (
        <div key={event.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-[var(--ink)]">{event.title}</span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${sourceBadgeClass(event.source)}`}>
                {sourceLabel(event.source)}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-[var(--muted)]">{formatRange(event.start, event.end)}</p>
            {event.location ? <p className="mt-0.5 text-xs text-[var(--muted)]">{event.location}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
