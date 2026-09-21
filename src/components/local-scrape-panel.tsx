"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { ApolloPerson, ImportSummary } from "@/lib/import-leads";

type Health = {
  enabled: boolean;
  sidecarUp: boolean;
  llm: string | null;
  model: string | null;
};

export function LocalScrapePanel() {
  const [health, setHealth] = useState<Health | null>(null);
  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [people, setPeople] = useState<ApolloPerson[]>([]);
  const [source, setSource] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/dev/scrape");
        if (!response.ok) return;
        const data = (await response.json()) as Health;
        if (!cancelled && data.enabled) setHealth(data);
      } catch {
        // Dev-only panel — hide if the probe fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!health) return null;

  async function handleScrape(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setScraping(true);
    setError("");
    setSummary(null);
    try {
      const response = await fetch("/api/dev/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Local scrape failed");
        setPeople([]);
        return;
      }
      setPeople(Array.isArray(data.people) ? data.people : []);
      setSource(typeof data.source === "string" ? data.source : url.trim());
    } catch {
      setError("Local scrape failed. Is the sidecar running?");
    } finally {
      setScraping(false);
    }
  }

  async function handleImport() {
    const withEmail = people.filter((person) => person.email);
    if (withEmail.length === 0) return;
    setImporting(true);
    setError("");
    try {
      const response = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ people: withEmail }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Import failed");
        return;
      }
      setSummary(data as ImportSummary);
    } catch {
      setError("Import failed. Check your connection and try again.");
    } finally {
      setImporting(false);
    }
  }

  const withEmail = people.filter((person) => person.email).length;

  return (
    <section className="lf-card flex flex-col gap-4 p-6">
      <div>
        <p className="lf-chip">Local only · ScrapeGraphAI</p>
        <h2 className="lf-display mt-2 text-xl font-semibold text-[var(--ink)]">Scrape a company page</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Uses the open-source library on your machine (not ScrapeGraph cloud, not production).{" "}
          {health.sidecarUp ? (
            <span>
              Sidecar up · {health.llm ?? "llm"} {health.model ? `(${health.model})` : ""}
            </span>
          ) : (
            <span>
              Sidecar down — run <code className="font-mono text-xs">npm run scrapegraph:local</code>
            </span>
          )}
        </p>
      </div>

      <form onSubmit={handleScrape} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <label className="lf-label">
          Page URL
          <input
            type="url"
            required
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/about"
            className="lf-input"
          />
        </label>
        <button type="submit" disabled={scraping || !url.trim()} className="lf-btn lf-btn-primary sm:self-end">
          {scraping ? "Scraping…" : "Scrape locally"}
        </button>
      </form>

      {error ? <p className="lf-alert lf-alert-error">{error}</p> : null}
      {summary ? (
        <p className="lf-alert lf-alert-ok">
          Imported {summary.imported}, updated {summary.updated}, skipped (no email){" "}
          {summary.skippedNoEmail}, failed {summary.failed}.{" "}
          <Link href="/contacts" className="font-semibold underline">
            View Contacts
          </Link>
        </p>
      ) : null}

      {people.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
            <p>
              {people.length} people from {source || "page"} · {withEmail} with email
            </p>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || withEmail === 0}
              className="lf-btn lf-btn-primary"
            >
              {importing ? "Importing…" : "Import people with email"}
            </button>
          </div>
          <div className="lf-table-wrap">
            <table className="lf-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Company</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person, index) => (
                  <tr key={person.id ?? person.email ?? `row-${index}`}>
                    <td>
                      {[person.first_name, person.last_name].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td>{person.title ?? "—"}</td>
                    <td>{person.organization?.name ?? "—"}</td>
                    <td>{person.email ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
