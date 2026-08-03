"use client";

import { Suspense, useCallback, useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarAgenda, type AgendaEvent } from "@/components/calendar-agenda";
import { CalendarConnectCard, type CalendarConnectionSummary } from "@/components/calendar-connect-card";

function CalendarPageContent() {
  const searchParams = useSearchParams();

  const [connection, setConnection] = useState<CalendarConnectionSummary>({
    provider: null,
    label: null,
    googleEmail: null,
    icalUrl: null,
    bookingUrl: null,
    connectedAt: null,
  });
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, startLoadTransition] = useTransition();
  const [, startConnectionTransition] = useTransition();

  const fetchConnection = useCallback(() => {
    startConnectionTransition(async () => {
      try {
        const response = await fetch("/api/calendar/connection");
        const data = await response.json();
        if (response.ok) {
          setConnection(data.connection as CalendarConnectionSummary);
          setGoogleConfigured(Boolean(data.googleConfigured));
        }
      } catch {
        // Non-fatal — connect card just shows "not connected" state.
      }
    });
  }, [startConnectionTransition]);

  const fetchEvents = useCallback(() => {
    startLoadTransition(async () => {
      setError("");
      try {
        const response = await fetch("/api/calendar/events");
        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "Failed to load calendar events");
          return;
        }
        setEvents(data.events as AgendaEvent[]);
        setWarning(data.warning ?? null);
      } catch {
        setError("Failed to load calendar events. Check your connection and try again.");
      }
    });
  }, []);

  useEffect(() => {
    fetchConnection();
    fetchEvents();
  }, [fetchConnection, fetchEvents]);

  const googleStatus = searchParams.get("google");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-5 py-6 sm:gap-6 sm:px-8 sm:py-8">
      <div className="lf-rise">
        <p className="lf-chip">Meetings</p>
        <h1 className="lf-display mt-2 text-3xl font-semibold text-[var(--ink)]">Calendar</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Connect Google Calendar, an iCal feed, or a booking link to see upcoming meetings.
        </p>
      </div>

      {googleStatus === "connected" ? (
        <p className="lf-alert lf-alert-ok">Google Calendar connected.</p>
      ) : googleStatus === "error" ? (
        <p className="lf-alert lf-alert-error">
          Couldn&apos;t connect Google Calendar{searchParams.get("message") ? `: ${searchParams.get("message")}` : "."}
        </p>
      ) : null}

      <CalendarConnectCard
        connection={connection}
        googleConfigured={googleConfigured}
        onSaved={() => {
          fetchConnection();
          fetchEvents();
        }}
      />

      {error ? <p className="lf-alert lf-alert-error">{error}</p> : null}
      {warning ? <p className="lf-alert lf-alert-warn">{warning}</p> : null}

      <div className="flex flex-col gap-3">
        <h2 className="lf-display text-xl font-semibold text-[var(--ink)]">Upcoming</h2>
        {loading ? <p className="text-sm text-[var(--muted)]">Loading events…</p> : <CalendarAgenda events={events} />}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="px-5 py-8 text-sm text-[var(--muted)]">Loading…</div>}>
      <CalendarPageContent />
    </Suspense>
  );
}
