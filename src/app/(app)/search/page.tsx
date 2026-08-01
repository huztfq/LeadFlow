"use client";

import { useState } from "react";
import type { ApolloSearchFilters } from "@/lib/apollo";
import type { ApolloPerson, ImportSummary } from "@/lib/import-leads";
import { SearchForm } from "@/components/search-form";
import { PeopleResultsTable, personKey } from "@/components/people-results-table";

export default function SearchPage() {
  const [people, setPeople] = useState<ApolloPerson[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);

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
    setSelectedKeys((prev) =>
      prev.size === people.length ? new Set() : new Set(people.map((person, index) => personKey(person, index))),
    );
  }

  async function handleImportSelected() {
    const selectedPeople = people.filter((person, index) => selectedKeys.has(personKey(person, index)));
    if (selectedPeople.length === 0) return;

    setImporting(true);
    setError("");

    try {
      const response = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ people: selectedPeople }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Import failed");
        return;
      }

      setSummary(data as ImportSummary);
      setSelectedKeys(new Set());
    } catch {
      setError("Import failed. Check your connection and try again.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Search leads</h1>
        <p className="text-sm text-zinc-500">Search Apollo for people and import them as leads.</p>
      </div>

      <SearchForm onSearch={handleSearch} loading={searching} />

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {summary ? (
        <p className="rounded border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          Imported {summary.imported}, updated {summary.updated}, skipped (no email) {summary.skippedNoEmail}, failed{" "}
          {summary.failed}.
        </p>
      ) : null}

      {people.length > 0 ? (
        <p className="text-sm text-zinc-500">
          Showing {people.length} of {total} results.
        </p>
      ) : null}

      <PeopleResultsTable
        people={people}
        selectedKeys={selectedKeys}
        onToggle={handleToggle}
        onToggleAll={handleToggleAll}
        onImportSelected={handleImportSelected}
        importing={importing}
      />
    </div>
  );
}
