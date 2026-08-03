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
  const [onlyWithEmail, setOnlyWithEmail] = useState(true);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch({
      q_keywords: keywords.trim() || undefined,
      person_titles: splitList(titles),
      person_locations: splitList(locations),
      q_organization_industry_keywords: industry.trim() || undefined,
      contact_email_status: onlyWithEmail ? ["verified", "unverified"] : undefined,
      per_page: Number(perPage) || undefined,
      page: 1,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="lf-card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-5"
    >
      <label className="lf-label lg:col-span-2">
        Keywords
        <input
          type="text"
          value={keywords}
          onChange={(event) => setKeywords(event.target.value)}
          placeholder="e.g. dentist"
          className="lf-input"
        />
      </label>

      <label className="lf-label">
        Titles (comma-separated)
        <input
          type="text"
          value={titles}
          onChange={(event) => setTitles(event.target.value)}
          placeholder="e.g. Owner, CEO"
          className="lf-input"
        />
      </label>

      <label className="lf-label">
        Locations (comma-separated)
        <input
          type="text"
          value={locations}
          onChange={(event) => setLocations(event.target.value)}
          placeholder="e.g. Austin, TX"
          className="lf-input"
        />
      </label>

      <label className="lf-label">
        Industry
        <input
          type="text"
          value={industry}
          onChange={(event) => setIndustry(event.target.value)}
          placeholder="e.g. dental"
          className="lf-input"
        />
      </label>

      <label className="lf-label">
        Results per page
        <input
          type="number"
          min={1}
          max={100}
          value={perPage}
          onChange={(event) => setPerPage(event.target.value)}
          className="lf-input"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)] lg:col-span-3">
        <input
          type="checkbox"
          checked={onlyWithEmail}
          onChange={(event) => setOnlyWithEmail(event.target.checked)}
        />
        Prefer people with email on file (still need Enrich to reveal)
      </label>

      <div className="flex items-end lg:col-span-2">
        <button type="submit" disabled={loading} className="lf-btn lf-btn-primary" aria-busy={loading}>
          {loading ? (
            <>
              <span className="lf-spinner" aria-hidden="true" />
              Searching…
            </>
          ) : (
            "Search"
          )}
        </button>
      </div>
    </form>
  );
}
