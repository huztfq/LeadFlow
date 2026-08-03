"use client";

import { FormEvent, useState } from "react";
import { CheckIcon, CloseIcon } from "@/components/studio-icons";

const USE_CASE_OPTIONS = ["Cold outreach", "Recruiting", "Investor outreach", "Partnerships"] as const;

type WaitlistState = "idle" | "submitting" | "done";

/** Shared waitlist signup modal — used by `/login` and every marketing-site CTA (see `WaitlistButton`). */
export function WaitlistModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [useCase, setUseCase] = useState("");
  const [state, setState] = useState<WaitlistState>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setError("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, useCase }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setState("idle");
    }
  }

  return (
    <div className="lf-modal-backdrop" onClick={onClose}>
      <div className="lf-modal" onClick={(event) => event.stopPropagation()}>
        <div className="lf-modal-header">
          <div>
            <p className="lf-modal-eyebrow">Private beta</p>
            <h2 className="lf-modal-title">Join the waitlist</h2>
          </div>
          <button type="button" onClick={onClose} className="lf-icon-btn" aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {state === "done" ? (
          <div className="lf-modal-body items-center text-center">
            <span className="lf-waitlist-success-icon">
              <CheckIcon width={20} height={20} />
            </span>
            <h3 className="lf-display text-lg font-semibold text-[var(--ink)]">You&rsquo;re on the list</h3>
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              Thanks — you&rsquo;re on the waitlist. Someone from Inferaform will reach out soon.
            </p>
            <button type="button" onClick={onClose} className="lf-btn lf-btn-primary mt-2 w-full">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="lf-modal-body">
            <label className="lf-label">
              Name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className="lf-input"
                required
                autoFocus
              />
            </label>
            <label className="lf-label">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                className="lf-input"
                required
              />
            </label>
            <label className="lf-label">
              What will you use Leadflow for?
              <input
                type="text"
                value={useCase}
                onChange={(event) => setUseCase(event.target.value)}
                placeholder="e.g. cold outreach for my agency"
                className="lf-input"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {USE_CASE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setUseCase(option)}
                  className={`lf-waitlist-chip${useCase === option ? " is-active" : ""}`}
                >
                  {option}
                </button>
              ))}
            </div>

            {error ? (
              <p className="lf-alert lf-alert-error" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={state === "submitting"} className="lf-btn lf-btn-primary w-full">
              {state === "submitting" ? "Submitting…" : "Request access"}
            </button>
            <p className="lf-modal-note">
              We&rsquo;ll only use this to reach out about Leadflow access — no spam, no account created yet.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

/** Trigger + modal wired together, for CTAs that just need "click to open the waitlist form". */
export function WaitlistButton({
  className = "lf-btn lf-btn-primary",
  children = "Join the waitlist",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open ? <WaitlistModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}
