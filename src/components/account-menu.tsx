"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type ProfileLite = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
};

function initials(profile: ProfileLite | null): string {
  if (!profile) return "…";
  const first = profile.firstName?.trim().charAt(0);
  const last = profile.lastName?.trim().charAt(0);
  const combined = `${first ?? ""}${last ?? ""}`;
  if (combined) return combined.toUpperCase();
  return profile.email.slice(0, 2).toUpperCase();
}

function displayName(profile: ProfileLite | null): string {
  if (!profile) return "Account";
  const full = [profile.firstName, profile.lastName].filter((part) => part && part.trim()).join(" ").trim();
  if (full) return full;
  if (profile.username) return profile.username;
  return profile.email;
}

/**
 * Account control anchored in the sidebar footer, right above Sign out.
 * Opens a small menu (Profile / Settings / Sign out) on hover for desktop
 * pointer users, and on click/tap everywhere else — so it's reachable by
 * keyboard and on mobile too. Closes on outside click, Escape, or
 * navigating to one of its links.
 */
export function AccountMenu({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/profile");
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setProfile(data.profile as ProfileLite);
      } catch {
        // Non-critical UI — silently ignore.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  function openNow() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  }

  function closeSoon() {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }

  function handleItemNavigate() {
    setOpen(false);
    onNavigate?.();
  }

  async function handleSignOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div
      ref={containerRef}
      className="lf-account-menu"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="lf-account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="lf-account-avatar" aria-hidden="true">
          {initials(profile)}
        </span>
        <span className="lf-account-label">
          <span className="lf-account-name">{displayName(profile)}</span>
          {profile ? <span className="lf-account-email">{profile.email}</span> : null}
        </span>
        <span className={`lf-account-chevron ${open ? "is-open" : ""}`} aria-hidden="true">
          ⌄
        </span>
      </button>

      {open ? (
        <div className="lf-menu lf-rise" role="menu">
          <Link href="/settings/profile" role="menuitem" className="lf-menu-item" onClick={handleItemNavigate}>
            Profile
          </Link>
          <Link href="/settings" role="menuitem" className="lf-menu-item" onClick={handleItemNavigate}>
            Settings
          </Link>
          <div className="lf-menu-divider" role="separator" />
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="lf-menu-item lf-menu-item--danger"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
