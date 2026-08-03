"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

type Profile = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  hasPassword: boolean;
};

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [, startLoadTransition] = useTransition();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  const load = useCallback(() => {
    startLoadTransition(async () => {
      setLoadError("");
      try {
        const response = await fetch("/api/profile");
        const data = await response.json();
        if (!response.ok) {
          setLoadError(data.error ?? "Failed to load your profile");
          return;
        }
        const p = data.profile as Profile;
        setProfile(p);
        setFirstName(p.firstName ?? "");
        setLastName(p.lastName ?? "");
        setUsername(p.username ?? "");
        setEmail(p.email);
      } catch {
        setLoadError("Failed to load your profile. Check your connection and try again.");
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          username: username.trim() ? username.trim().toLowerCase() : null,
          email: email.trim().toLowerCase(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSaveError(data.error ?? "Failed to save profile");
        return;
      }
      setProfile(data.profile as Profile);
      setSaved(true);
    } catch {
      setSaveError("Failed to save profile. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChangingPassword(true);
    setPasswordError("");
    setPasswordSaved(false);
    try {
      const response = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPassword || undefined,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setPasswordError(data.error ?? "Failed to change password");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
      load();
    } catch {
      setPasswordError("Failed to change password. Check your connection and try again.");
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6 sm:gap-6 sm:px-8 sm:py-8">
      <div className="lf-rise">
        <p className="lf-chip">Account</p>
        <h1 className="lf-display mt-2 text-3xl font-semibold text-[var(--ink)]">Profile</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Your name, username, email, and password.</p>
      </div>

      {loadError ? <p className="lf-alert lf-alert-error">{loadError}</p> : null}
      {!profile && !loadError ? <p className="text-sm text-[var(--muted)]">Loading…</p> : null}

      {profile ? (
        <form onSubmit={handleSaveProfile} className="lf-card flex flex-col gap-4 p-6">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Personal info</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="lf-label">
              First name
              <input
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                disabled={saving}
                placeholder="Ada"
                className="lf-input"
                maxLength={80}
              />
            </label>
            <label className="lf-label">
              Last name
              <input
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                disabled={saving}
                placeholder="Lovelace"
                className="lf-input"
                maxLength={80}
              />
            </label>
          </div>

          <label className="lf-label">
            Username
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={saving}
              placeholder="ada"
              className="lf-input"
              maxLength={32}
              pattern="[a-z0-9._-]{3,32}"
              title="3-32 lowercase letters, numbers, '.', '_' or '-'"
            />
          </label>

          <label className="lf-label">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={saving}
              required
              className="lf-input"
            />
          </label>

          {saveError ? <p className="lf-alert lf-alert-error">{saveError}</p> : null}
          {saved && !saveError ? <p className="lf-alert lf-alert-ok">Profile saved.</p> : null}

          <button type="submit" disabled={saving} className="lf-btn lf-btn-primary self-start">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      ) : null}

      {profile ? (
        <form onSubmit={handleChangePassword} className="lf-card flex flex-col gap-4 p-6">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">Password</h2>
            {!profile.hasPassword ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                You don&apos;t have a personal password yet — set one below to also sign in with your email,
                separately from the app password.
              </p>
            ) : null}
          </div>

          {profile.hasPassword ? (
            <label className="lf-label">
              Current password
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={changingPassword}
                required
                autoComplete="current-password"
                className="lf-input"
              />
            </label>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="lf-label">
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={changingPassword}
                required
                minLength={8}
                autoComplete="new-password"
                className="lf-input"
              />
            </label>
            <label className="lf-label">
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={changingPassword}
                required
                minLength={8}
                autoComplete="new-password"
                className="lf-input"
              />
            </label>
          </div>

          {passwordError ? <p className="lf-alert lf-alert-error">{passwordError}</p> : null}
          {passwordSaved && !passwordError ? <p className="lf-alert lf-alert-ok">Password updated.</p> : null}

          <button
            type="submit"
            disabled={changingPassword || !newPassword || !confirmPassword}
            className="lf-btn lf-btn-primary self-start"
          >
            {changingPassword ? "Updating…" : profile.hasPassword ? "Change password" : "Set password"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
