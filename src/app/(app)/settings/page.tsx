"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

type Prefs = {
  emailDigestOpens: boolean;
  emailDigestReplies: boolean;
  defaultFromName: string;
  timezone: string;
};

type Profile = {
  role: "owner" | "member";
  prefs: Prefs;
};

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [, startLoadTransition] = useTransition();

  const [emailDigestOpens, setEmailDigestOpens] = useState(true);
  const [emailDigestReplies, setEmailDigestReplies] = useState(true);
  const [defaultFromName, setDefaultFromName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    startLoadTransition(async () => {
      setLoadError("");
      try {
        const response = await fetch("/api/profile");
        const data = await response.json();
        if (!response.ok) {
          setLoadError(data.error ?? "Failed to load settings");
          return;
        }
        const p = data.profile as Profile;
        setProfile(p);
        setEmailDigestOpens(p.prefs.emailDigestOpens);
        setEmailDigestReplies(p.prefs.emailDigestReplies);
        setDefaultFromName(p.prefs.defaultFromName);
        setTimezone(p.prefs.timezone);
      } catch {
        setLoadError("Failed to load settings. Check your connection and try again.");
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      const response = await fetch("/api/profile/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefs: {
            emailDigestOpens,
            emailDigestReplies,
            defaultFromName: defaultFromName.trim(),
            timezone,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSaveError(data.error ?? "Failed to save settings");
        return;
      }
      setProfile(data.profile as Profile);
      setSaved(true);
    } catch {
      setSaveError("Failed to save settings. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6 sm:gap-6 sm:px-8 sm:py-8">
      <div className="lf-rise">
        <p className="lf-chip">Preferences</p>
        <h1 className="lf-display mt-2 text-3xl font-semibold text-[var(--ink)]">Settings</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Notification, sending, and timezone preferences.</p>
      </div>

      {loadError ? <p className="lf-alert lf-alert-error">{loadError}</p> : null}
      {!profile && !loadError ? <p className="text-sm text-[var(--muted)]">Loading…</p> : null}

      {profile ? (
        <form onSubmit={handleSave} className="lf-card flex flex-col gap-5 p-6">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">Email notifications</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Which campaign activity should send you a digest email.
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
                <input
                  type="checkbox"
                  checked={emailDigestOpens}
                  onChange={(event) => setEmailDigestOpens(event.target.checked)}
                  disabled={saving}
                />
                Opens digest
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
                <input
                  type="checkbox"
                  checked={emailDigestReplies}
                  onChange={(event) => setEmailDigestReplies(event.target.checked)}
                  disabled={saving}
                />
                Replies digest
              </label>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">Sending</h2>
            <label className="lf-label mt-3">
              Default from-name
              <input
                type="text"
                value={defaultFromName}
                onChange={(event) => setDefaultFromName(event.target.value)}
                disabled={saving}
                placeholder="e.g. Ada from Leadflow"
                className="lf-input"
                maxLength={120}
              />
            </label>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Shown as the sender display name on new campaigns you create.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">Timezone</h2>
            <label className="lf-label mt-3">
              Used for scheduling and displayed times
              <select
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                disabled={saving}
                className="lf-input"
              >
                <option value="">Browser default</option>
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {saveError ? <p className="lf-alert lf-alert-error">{saveError}</p> : null}
          {saved && !saveError ? <p className="lf-alert lf-alert-ok">Settings saved.</p> : null}

          <button type="submit" disabled={saving} className="lf-btn lf-btn-primary self-start">
            {saving ? "Saving…" : "Save settings"}
          </button>
        </form>
      ) : null}

      {profile?.role === "owner" ? (
        <div className="lf-card p-6">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Workspace</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Manage sending domain and teammates.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/settings/domain" className="lf-btn lf-btn-ghost">
              Domain
            </Link>
            <Link href="/settings/team" className="lf-btn lf-btn-ghost">
              Team
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
