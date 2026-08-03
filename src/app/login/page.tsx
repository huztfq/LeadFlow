"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LeadflowBrand } from "@/components/leadflow-brand";
import { CheckIcon, CloseIcon } from "@/components/studio-icons";

const PIPELINE = [
  { title: "Find leads", desc: "We draft an Apollo search from a plain-English brief." },
  { title: "Enrich & import", desc: "Verified contacts land in Leadflow, ready to sequence." },
  { title: "Send the sequence", desc: "Resend delivers each step on schedule, tracked end to end." },
  { title: "Reply & book", desc: "Inbox triage surfaces interest so you can book the call." },
] as const;

const USE_CASE_OPTIONS = ["Cold outreach", "Recruiting", "Investor outreach", "Partnerships"] as const;

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  not_invited: "That Google account isn't invited yet. Join the waitlist below and we'll reach out.",
  oauth_failed: "Google sign-in didn't go through. Try again, or use your email and password.",
  not_configured: "Google sign-in isn't set up yet. Use your email and password for now.",
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18Z"
      />
      <path fill="#FBBC05" d="M3.95 10.7a5.4 5.4 0 0 1 0-3.4V4.97H.9a9 9 0 0 0 0 8.06l3.05-2.33Z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}

type WaitlistState = "idle" | "submitting" | "done";

function WaitlistModal({ onClose }: { onClose: () => void }) {
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

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleError = searchParams.get("googleError");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      router.push("/assistant");
      return;
    }

    setError("That email or password didn't match. Try again.");
    setLoading(false);
  }

  return (
    <div className="lf-auth-shell">
      <div className="lf-auth-hero-dots" aria-hidden />

      <div className="lf-auth-hero-content">
        <LeadflowBrand size="lg" tone="light" showByline />
        <span className="lf-auth-eyebrow">
          <span className="lf-auth-eyebrow-dot" aria-hidden />
          Private beta
        </span>
        <h1 className="lf-auth-headline">Design outreach with us</h1>
        <p className="lf-auth-sub">
          Chat with us to plan a sequence, approve it once, then let Leadflow enrich Apollo leads,
          send via Resend, and surface replies worth acting on.
        </p>
        <div className="lf-auth-pipeline">
          {PIPELINE.map((step, index) => (
            <div key={step.title} className="lf-auth-pipeline-row">
              <span className="lf-auth-pipeline-rail">
                <span className="lf-auth-pipeline-dot">{index + 1}</span>
                {index < PIPELINE.length - 1 ? <span className="lf-auth-pipeline-thread" /> : null}
              </span>
              <div>
                <p className="lf-auth-pipeline-title">{step.title}</p>
                <p className="lf-auth-pipeline-desc">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="lf-auth-hero-foot">A product of Inferaform</p>
      </div>

      <div className="lf-auth-card-wrap">
        <form onSubmit={handleSubmit} className="lf-auth-card lf-rise">
          <p className="lf-auth-chip">Sign in</p>
          <h2 className="lf-auth-title mt-3">Welcome back</h2>
          <p className="lf-auth-desc">Enter your details to get to your desk.</p>

          {googleError ? (
            <p className="lf-auth-alert">{GOOGLE_ERROR_MESSAGES[googleError] ?? "Couldn't sign in with Google. Try again."}</p>
          ) : null}

          <div className="mt-6 flex flex-col gap-4">
            <label className="lf-auth-label">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                className="lf-auth-input"
                autoFocus
              />
            </label>
            <label className="lf-auth-label">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Your password"
                className="lf-auth-input"
                required
              />
            </label>
          </div>

          {error ? (
            <p className="lf-auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={loading} className="lf-btn lf-btn-primary mt-5 w-full">
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <div className="lf-auth-divider">or</div>

          <a href="/api/auth/google/connect" className="lf-auth-google-btn">
            <GoogleIcon />
            Continue with Google
          </a>
          <p className="lf-auth-note">Google sign-in works for invited teammates only.</p>

          <div className="lf-auth-footer">
            <p className="lf-auth-footer-note mb-3">New to Leadflow?</p>
            <button
              type="button"
              onClick={() => setWaitlistOpen(true)}
              className="lf-btn lf-btn-primary w-full"
            >
              Join the waitlist
            </button>
          </div>
        </form>
      </div>

      {waitlistOpen ? <WaitlistModal onClose={() => setWaitlistOpen(false)} /> : null}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="lf-auth-shell" />}>
      <LoginForm />
    </Suspense>
  );
}
