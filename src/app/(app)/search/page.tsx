"use client";

import { useState } from "react";
import Link from "next/link";
import type { ApolloSearchFilters } from "@/lib/apollo";
import type { ApolloPerson, ImportSummary } from "@/lib/import-leads";
import { SearchForm } from "@/components/search-form";
import { PeopleResultsTable, personKey } from "@/components/people-results-table";
import { LoadingOverlay } from "@/components/loading-overlay";

type EnrichImportSummary = ImportSummary & {
  enriched?: number;
  enrichFailed?: number;
};

export default function SearchPage() {
  const [people, setPeople] = useState<ApolloPerson[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<EnrichImportSummary | null>(null);

  async function handleSearch(filters: ApolloSearchFilters) {
    setSearching(true);
    setError("");
    setSummary(null);

    try {
      const response = await fetch("/api/apollo/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Search failed");
        setPeople([]);
        setTotal(0);
        return;
      }

      setPeople(data.people ?? []);
      setTotal(data.total ?? 0);
      setSelectedKeys(new Set());
    } catch {
      setError("Search failed. Check your connection and try again.");
    } finally {
      setSearching(false);
    }
  }

  function handleToggle(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleToggleAll() {
    const selectable = people
      .map((person, index) => ({ person, key: personKey(person, index) }))
      .filter(({ person }) => Boolean(person.id));
    setSelectedKeys((prev) =>
      prev.size === selectable.length ? new Set() : new Set(selectable.map(({ key }) => key)),
    );
  }

  async function handleEnrichImport() {
    const apolloIds = people
      .filter((person, index) => selectedKeys.has(personKey(person, index)) && person.id)
      .map((person) => person.id as string);

    if (apolloIds.length === 0) return;

    setImporting(true);
    setError("");

    try {
      const response = await fetch("/api/apollo/enrich-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apolloIds }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Enrich & import failed");
        return;
      }

      setSummary(data as EnrichImportSummary);
      setSelectedKeys(new Set());
    } catch {
      setError("Enrich & import failed. Check your connection and try again.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 py-6 sm:gap-6 sm:px-8 sm:py-8">
      <div className="lf-rise">
        <p className="lf-chip">Manual Apollo</p>
        <h1 className="lf-display mt-2 text-3xl font-semibold text-[var(--ink)]">Search leads</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Prefer <Link href="/assistant" className="font-semibold text-[var(--signal-deep)] underline">Studio</Link> for
          Claude-designed runs — or search Apollo here, enrich selected people, and save to{" "}
          <Link href="/contacts" className="font-semibold text-[var(--signal-deep)] underline">
            Contacts
          </Link>
          .
        </p>
      </div>

      <SearchForm onSearch={handleSearch} loading={searching} />

      {error ? <p className="lf-alert lf-alert-error">{error}</p> : null}

      {summary ? (
        <p className="lf-alert lf-alert-ok">
          Enriched {summary.enriched ?? 0}
          {summary.enrichFailed ? ` (${summary.enrichFailed} enrich failed)` : ""}. Saved — imported{" "}
          {summary.imported}, updated {summary.updated}, skipped (no email) {summary.skippedNoEmail},
          failed {summary.failed}.{" "}
          <Link href="/contacts" className="font-semibold underline">
            View Contacts
          </Link>
        </p>
      ) : null}

      {people.length > 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Showing {people.length} of {total} results.
        </p>
      ) : null}

      <div className={searching ? "relative min-h-[160px]" : undefined}>
        {searching ? <LoadingOverlay label="Searching Apollo…" /> : null}
        <PeopleResultsTable
          people={people}
          selectedKeys={selectedKeys}
          onToggle={handleToggle}
          onToggleAll={handleToggleAll}
          onEnrichImport={handleEnrichImport}
          importing={importing}
        />
      </div>
    </div>
  );
}
