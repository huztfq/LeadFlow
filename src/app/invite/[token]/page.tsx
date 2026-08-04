"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LeadflowBrand } from "@/components/leadflow-brand";
import { LoadingOverlay } from "@/components/loading-overlay";

type InviteInfo = { email: string; accepted: boolean; expired: boolean };
type LoadState = { status: "loading" } | { status: "ready"; invite: InviteInfo } | { status: "error"; message: string };

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/invites/${token}`);
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setState({ status: "error", message: data.error ?? "Invite not found" });
          return;
        }
        setState({ status: "ready", invite: data as InviteInfo });
      } catch {
        if (!cancelled) setState({ status: "error", message: "Failed to load invite" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setSubmitError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, name: name.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSubmitError(data.error ?? "Failed to accept invite");
        setSubmitting(false);
        return;
      }
      router.push("/assistant");
    } catch {
      setSubmitError("Failed to accept invite. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-full flex-1 items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-[var(--signal)]/15 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
      </div>

      <div className="lf-card lf-rise relative w-full max-w-md p-8 sm:p-10">
        <p className="lf-chip mb-4">Team invite</p>
        <h1 className="sr-only">Accept your Leadflow invite</h1>
        <LeadflowBrand size="lg" />

        {state.status === "loading" ? (
          <div className="relative mt-6 min-h-[120px]">
            <LoadingOverlay label="Loading invite…" />
          </div>
        ) : null}

        {state.status === "error" ? (
          <p className="mt-6 text-sm text-[var(--danger)]" role="alert">
            {state.message}
          </p>
        ) : null}

        {state.status === "ready" && state.invite.accepted ? (
          <p className="mt-6 text-sm text-[var(--ink-soft)]">
            This invite has already been used. Sign in from the{" "}
            <a href="/login" className="font-medium text-[var(--signal)] hover:underline">
              login page
            </a>{" "}
            instead.
          </p>
        ) : null}

        {state.status === "ready" && !state.invite.accepted && state.invite.expired ? (
          <p className="mt-6 text-sm text-[var(--danger)]">
            This invite link has expired. Ask whoever invited you to send a new one.
          </p>
        ) : null}

        {state.status === "ready" && !state.invite.accepted && !state.invite.expired ? (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              Set a password for <span className="font-medium text-[var(--ink)]">{state.invite.email}</span> to
              finish joining Leadflow.
            </p>

            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--ink-soft)]">
              Name (optional)
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ada Lovelace"
                className="lf-input"
                autoFocus
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--ink-soft)]">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                className="lf-input"
                required
                minLength={8}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--ink-soft)]">
              Confirm password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your password"
                className="lf-input"
                required
                minLength={8}
              />
            </label>

            {submitError ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {submitError}
              </p>
            ) : null}

            <button type="submit" disabled={submitting} className="lf-btn lf-btn-primary mt-2 w-full">
              {submitting ? "Joining…" : "Join Leadflow"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
