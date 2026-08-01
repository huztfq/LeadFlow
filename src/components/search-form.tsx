"use client";

import { FormEvent, useState } from "react";
import type { ApolloSearchFilters } from "@/lib/apollo";

type SearchFormProps = {
  onSearch: (filters: ApolloSearchFilters) => void;
  loading: boolean;
};

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function SearchForm({ onSearch, loading }: SearchFormProps) {
  const [keywords, setKeywords] = useState("");
  const [titles, setTitles] = useState("");
  const [locations, setLocations] = useState("");
  const [industry, setIndustry] = useState("");
  const [perPage, setPerPage] = useState("25");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch({
      q_keywords: keywords.trim() || undefined,
      person_titles: splitList(titles),
      person_locations: splitList(locations),
      q_organization_industry_keywords: industry.trim() || undefined,
      per_page: Number(perPage) || undefined,
      page: 1,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-5"
    >
      <label className="flex flex-col gap-1 text-sm text-zinc-700 lg:col-span-2">
        Keywords
        <input
          type="text"
          value={keywords}
          onChange={(event) => setKeywords(event.target.value)}
          placeholder="e.g. dentist"
          className="rounded border border-zinc-300 px-3 py-2 text-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Titles (comma-separated)
        <input
          type="text"
          value={titles}
          onChange={(event) => setTitles(event.target.value)}
          placeholder="e.g. Owner, CEO"
          className="rounded border border-zinc-300 px-3 py-2 text-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Locations (comma-separated)
        <input
          type="text"
          value={locations}
          onChange={(event) => setLocations(event.target.value)}
          placeholder="e.g. Austin, TX"
          className="rounded border border-zinc-300 px-3 py-2 text-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Industry
        <input
          type="text"
          value={industry}
          onChange={(event) => setIndustry(event.target.value)}
          placeholder="e.g. dental"
          className="rounded border border-zinc-300 px-3 py-2 text-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Results per page
        <input
          type="number"
          min={1}
          max={100}
          value={perPage}
          onChange={(event) => setPerPage(event.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-zinc-900"
        />
      </label>

      <div className="flex items-end lg:col-span-5">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>
    </form>
  );
}
