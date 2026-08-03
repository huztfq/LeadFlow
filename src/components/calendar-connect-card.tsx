"use client";

import { useState } from "react";

export type CalendarConnectionSummary = {
  provider: "google" | "ical" | "link" | null;
  label: string | null;
  googleEmail: string | null;
  icalUrl: string | null;
  bookingUrl: string | null;
  connectedAt: string | null;
};

type CalendarConnectCardProps = {
  connection: CalendarConnectionSummary;
  googleConfigured: boolean;
  onSaved: () => void;
};

function providerLabel(connection: CalendarConnectionSummary): string {
  switch (connection.provider) {
    case "google":
      return connection.googleEmail ? `Google Calendar · ${connection.googleEmail}` : "Google Calendar";
    case "ical":
      return connection.label ? `iCal feed · ${connection.label}` : "iCal feed";
    case "link":
      return connection.label ? `Booking link · ${connection.label}` : "Booking link";
    default:
      return "Not connected";
  }
}

export function CalendarConnectCard({ connection, googleConfigured, onSaved }: CalendarConnectCardProps) {
  const [mode, setMode] = useState<"ical" | "link">("ical");
  const [icalUrl, setIcalUrl] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);

  const isConnected = connection.provider !== null;

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body =
        mode === "ical"
          ? { provider: "ical", icalUrl: icalUrl.trim(), label: label.trim() || undefined }
          : { provider: "link", bookingUrl: bookingUrl.trim(), label: label.trim() || undefined };

      const response = await fetch("/api/calendar/connection", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to save calendar connection");
        return;
      }
      setIcalUrl("");
      setBookingUrl("");
      setLabel("");
      onSaved();
    } catch {
      setError("Failed to save calendar connection. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm("Disconnect this calendar?")) return;
    setDisconnecting(true);
    try {
      await fetch("/api/calendar/connection", { method: "DELETE" });
      onSaved();
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="lf-card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ink)]">{providerLabel(connection)}</h2>
          {connection.connectedAt ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Connected {new Date(connection.connectedAt).toLocaleDateString()}
            </p>
          ) : (
            <p className="mt-1 text-xs text-[var(--muted)]">Connect a calendar to see upcoming events here.</p>
          )}
        </div>
        {isConnected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="lf-btn lf-btn-ghost !px-3 !py-1.5 text-xs text-[var(--danger)]"
          >
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        ) : null}
        {connection.provider === "link" && connection.bookingUrl ? (
          <a href={connection.bookingUrl} target="_blank" rel="noreferrer" className="lf-btn lf-btn-primary !px-3 !py-1.5 text-xs">
            Open booking link
          </a>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 border-t border-[var(--line)] pt-4">
        <div>
          <p className="mb-2 text-sm font-semibold text-[var(--ink)]">
            {isConnected ? "Replace connection" : "Connect Google Calendar"}
          </p>
          <button
            type="button"
            onClick={() => (window.location.href = "/api/calendar/google/connect")}
            disabled={!googleConfigured}
            className="lf-btn lf-btn-primary"
            title={googleConfigured ? undefined : "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to enable"}
          >
            Connect Google Calendar
          </button>
          {!googleConfigured ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Not configured — set <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, and{" "}
              <code>GOOGLE_REDIRECT_URI</code> in your environment (see README) to enable OAuth.
            </p>
          ) : null}
        </div>

        <div className="border-t border-[var(--line)] pt-4">
          <p className="mb-2 text-sm font-semibold text-[var(--ink)]">Or use an iCal feed / booking link</p>
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("ical")}
              className={mode === "ical" ? "lf-btn lf-btn-primary !px-3 !py-1.5 text-xs" : "lf-btn lf-btn-ghost !px-3 !py-1.5 text-xs"}
            >
              iCal URL
            </button>
            <button
              type="button"
              onClick={() => setMode("link")}
              className={mode === "link" ? "lf-btn lf-btn-primary !px-3 !py-1.5 text-xs" : "lf-btn lf-btn-ghost !px-3 !py-1.5 text-xs"}
            >
              Booking link
            </button>
          </div>

          <form onSubmit={handleSave} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {mode === "ical" ? (
              <label className="lf-label flex-1">
                Secret iCal URL
                <input
                  type="url"
                  value={icalUrl}
                  onChange={(event) => setIcalUrl(event.target.value)}
                  placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                  required
                  className="lf-input"
                />
              </label>
            ) : (
              <label className="lf-label flex-1">
                Booking link
                <input
                  type="url"
                  value={bookingUrl}
                  onChange={(event) => setBookingUrl(event.target.value)}
                  placeholder="https://cal.com/you/intro-call"
                  required
                  className="lf-input"
                />
              </label>
            )}
            <label className="lf-label w-full sm:w-48">
              Label (optional)
              <input
                type="text"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Work calendar"
                className="lf-input"
              />
            </label>
            <button type="submit" disabled={saving} className="lf-btn lf-btn-ghost">
              {saving ? "Saving…" : "Save"}
            </button>
          </form>
          {mode === "ical" ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              In Google Calendar: Settings → your calendar → &quot;Secret address in iCal format&quot;. Anyone with this
              URL can read your events, so treat it like a password.
            </p>
          ) : null}
        </div>
      </div>

      {error ? <p className="lf-alert lf-alert-error mt-4">{error}</p> : null}
    </div>
  );
}
