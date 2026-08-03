"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { ApolloUsage } from "@/lib/apollo";

const APOLLO_BILLING_URL = "https://app.apollo.io/#/settings/plans/information";

type FetchState =
  | { status: "loading" }
  | { status: "ready"; usage: ApolloUsage }
  | { status: "error"; message: string };

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/**
 * Small header control showing remaining Apollo credits. Apollo doesn't expose
 * a dedicated "usage" endpoint to standard (non-master) API keys — the closest
 * official source is the Get Current User Profile endpoint's
 * `include_credit_usage` flag, which reports remaining lead/dial/export/AI
 * credits (0 credits to call). If that call fails (e.g. no credit data on the
 * plan), we show a plain "unavailable" state instead of guessing numbers.
 */
export function ApolloUsageBadge() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchUsage = useCallback(() => {
    startTransition(async () => {
      setState({ status: "loading" });
      try {
        const response = await fetch("/api/apollo/usage");
        const data = await response.json();
        if (!response.ok) {
          setState({ status: "error", message: data.error ?? "Apollo usage unavailable" });
          return;
        }
        setState({ status: "ready", usage: data as ApolloUsage });
      } catch {
        setState({ status: "error", message: "Apollo usage unavailable" });
      }
    });
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const label =
    state.status === "ready" && state.usage.creditsRemaining !== null
      ? `${formatNumber(state.usage.creditsRemaining)} credits`
      : state.status === "loading"
        ? "Apollo credits…"
        : "Apollo credits";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="lf-chip"
        style={{ cursor: "pointer", border: "none" }}
        aria-expanded={open}
      >
        {label}
      </button>

      {open ? (
        <div
          className="lf-card lf-rise absolute right-0 top-full z-30 mt-2 w-72 p-4 text-sm"
          role="dialog"
          aria-label="Apollo credit usage"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="lf-display text-base font-semibold text-[var(--ink)]">Apollo credits</span>
            <button
              type="button"
              onClick={fetchUsage}
              className="text-xs font-semibold text-[var(--signal)] hover:underline"
              disabled={state.status === "loading"}
            >
              {state.status === "loading" ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {state.status === "error" ? (
            <div className="flex flex-col gap-2">
              <p className="text-[var(--ink-soft)]">
                Usage isn&apos;t available from the Apollo API right now.
              </p>
              <a
                href={APOLLO_BILLING_URL}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[var(--signal)] hover:underline"
              >
                View credits in Apollo →
              </a>
            </div>
          ) : null}

          {state.status === "loading" ? <p className="text-[var(--muted)]">Loading…</p> : null}

          {state.status === "ready" ? (
            <div className="flex flex-col gap-3">
              {state.usage.accountName ? (
                <p className="text-xs text-[var(--muted)]">{state.usage.accountName}</p>
              ) : null}

              {state.usage.buckets.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {state.usage.buckets.map((bucket) => (
                    <li key={bucket.label} className="flex items-center justify-between gap-3">
                      <span className="text-[var(--ink-soft)]">{bucket.label}</span>
                      <span className="font-medium text-[var(--ink)]">
                        {formatNumber(bucket.remaining)} / {formatNumber(bucket.allowance)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[var(--ink-soft)]">
                  Apollo returned no credit breakdown for this account.
                </p>
              )}

              <a
                href={APOLLO_BILLING_URL}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-[var(--signal)] hover:underline"
              >
                Manage plan & credits in Apollo →
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
