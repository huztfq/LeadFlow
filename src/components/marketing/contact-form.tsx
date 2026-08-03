"use client";

import { FormEvent, useState } from "react";
import { CheckIcon } from "@/components/studio-icons";

type FormState = "idle" | "submitting" | "done";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setError("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, message }),
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

  if (state === "done") {
    return (
      <div className="lf-mkt-contact-form lf-mkt-contact-success">
        <span className="lf-waitlist-success-icon">
          <CheckIcon width={20} height={20} />
        </span>
        <h3 className="lf-display text-lg font-semibold text-[var(--ink)]">Message sent</h3>
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          Thanks, {name.split(" ")[0] || "there"} — we&rsquo;ll get back to you at {email} soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="lf-mkt-contact-form">
      <div className="lf-mkt-contact-form-row">
        <label className="lf-label">
          Name
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            className="lf-input"
            required
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
      </div>

      <label className="lf-label">
        Company <span className="text-[var(--muted)] font-normal">(optional)</span>
        <input
          type="text"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          placeholder="Where you work"
          className="lf-input"
        />
      </label>

      <label className="lf-label">
        Message
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="What can we help with?"
          className="lf-input"
          rows={5}
          required
        />
      </label>

      {error ? (
        <p className="lf-alert lf-alert-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={state === "submitting"} className="lf-btn lf-btn-primary w-full">
        {state === "submitting" ? "Sending…" : "Send message"}
      </button>
      <p className="lf-modal-note">
        Looking to try Leadflow itself? Join the <a href="/login">waitlist</a> instead — this form
        is for sales, partnerships, and anything else.
      </p>
    </form>
  );
}
