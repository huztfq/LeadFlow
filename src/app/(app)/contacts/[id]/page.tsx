"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import type { SpeedAuditFacts } from "@/lib/apollo-context";
import { renderTemplate } from "@/lib/merge-fields";
import { LoadingOverlay } from "@/components/loading-overlay";

type LeadDetail = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  title: string | null;
  company: string | null;
  industry: string | null;
  location: string | null;
  phone: string | null;
  speedAudit: SpeedAuditFacts | null;
};

type LoadState = "loading" | "not_found" | "ready" | "error";

const PREVIEW_TEMPLATE =
  "I filled in your form and you replied {{responseTime}} later. Full report: {{auditUrl}}";

const CHANNEL_LABEL: Record<NonNullable<SpeedAuditFacts["channel"]>, string> = {
  sms: "SMS",
  call: "Phone call",
  email: "Email",
};

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>("loading");
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [auditUrl, setAuditUrl] = useState("");
  const [error, setError] = useState("");
  const [auditError, setAuditError] = useState("");
  const [, startLoad] = useTransition();
  const [saving, startSave] = useTransition();

  const load = useCallback(() => {
    startLoad(async () => {
      setError("");
      try {
        const response = await fetch(`/api/leads/${params.id}`);
        if (response.status === 404) {
          setState("not_found");
          return;
        }
        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "Failed to load this contact");
          setState("error");
          return;
        }
        const detail = data.lead as LeadDetail;
        setLead(detail);
        setAuditUrl(detail.speedAudit?.reportUrl ?? "");
        setState("ready");
      } catch {
        setError("Failed to load this contact. Check your connection and try again.");
        setState("error");
      }
    });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  function updateAudit(method: "POST" | "DELETE") {
    startSave(async () => {
      setAuditError("");
      try {
        const response = await fetch(`/api/leads/${params.id}/speed-audit`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: method === "POST" ? JSON.stringify({ url: auditUrl }) : undefined,
        });
        const data = await response.json();
        if (!response.ok) {
          setAuditError(data.error ?? "Couldn't save the speed audit");
          return;
        }
        const speedAudit = data.speedAudit as SpeedAuditFacts | null;
        setLead((current) => (current ? { ...current, speedAudit } : current));
        setAuditUrl(speedAudit?.reportUrl ?? "");
      } catch {
        setAuditError("Couldn't save the speed audit. Check your connection and try again.");
      }
    });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    updateAudit("POST");
  }

  if (state === "loading") {
    return <LoadingOverlay fixed label="Loading contact…" />;
  }

  if (!lead) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 py-6 sm:px-8 sm:py-8">
        <p className="lf-alert lf-alert-error">{error || "That contact couldn't be found."}</p>
        <Link href="/contacts" className="lf-btn lf-btn-ghost self-start">
          Back to Contacts
        </Link>
      </div>
    );
  }

  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.email || "Contact";
  const audit = lead.speedAudit;
  const profile: [string, string | null][] = [
    ["Email", lead.email],
    ["Phone", lead.phone],
    ["Company", lead.company],
    ["Title", lead.title],
    ["Industry", lead.industry],
    ["Location", lead.location],
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6 sm:gap-6 sm:px-8 sm:py-8">
      <div className="lf-rise flex flex-col gap-2">
        <Link href="/contacts" className="text-xs font-semibold text-[var(--signal-deep)]">
          ← Contacts
        </Link>
        <h1 className="lf-display mt-1 text-2xl font-semibold text-[var(--ink)] sm:text-3xl">{name}</h1>
        {lead.company ? <p className="text-sm text-[var(--muted)]">{lead.company}</p> : null}
      </div>

      <div className="lf-card flex flex-col gap-3 p-6">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Profile</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          {profile.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-[var(--muted)]">{label}</dt>
              <dd className="text-[var(--ink)]">{value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="lf-card flex flex-col gap-4 p-6">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Speed audit</h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="lf-label">
            Speed audit report URL
            <input
              type="url"
              value={auditUrl}
              onChange={(event) => setAuditUrl(event.target.value)}
              placeholder="https://pronto.inferaform.com/r/…"
              className="lf-input"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving || !auditUrl.trim()} className="lf-btn lf-btn-primary">
              {saving ? "Fetching report…" : "Save"}
            </button>
            {audit ? (
              <button
                type="button"
                onClick={() => updateAudit("DELETE")}
                disabled={saving}
                className="lf-btn lf-btn-ghost"
              >
                Remove
              </button>
            ) : null}
          </div>
        </form>
        {auditError ? <p className="lf-alert lf-alert-error">{auditError}</p> : null}

        {audit ? (
          <>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-[var(--muted)]">Response time</dt>
                <dd className="font-semibold text-[var(--ink)]">{audit.responseTime}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">First reply by</dt>
                <dd className="text-[var(--ink)]">{audit.channel ? CHANNEL_LABEL[audit.channel] : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">Tested</dt>
                <dd className="text-[var(--ink)]">
                  {audit.testedAt ? new Date(audit.testedAt).toLocaleString() : "—"}
                </dd>
              </div>
            </dl>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-[var(--muted)]">
                Merge field preview ({"{{responseTime}}"}, {"{{auditUrl}}"})
              </span>
              <p className="rounded-md bg-[var(--paper)] px-3 py-2 text-[var(--ink)]">
                {renderTemplate(PREVIEW_TEMPLATE, {
                  responseTime: audit.responseTime,
                  auditUrl: audit.reportUrl,
                })}
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            No audit yet. {"{{responseTime}}"} and {"{{auditUrl}}"} render empty for this contact.
          </p>
        )}
      </div>
    </div>
  );
}
