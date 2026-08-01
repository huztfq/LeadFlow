"use client";

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LeadsTable, type LeadRow } from "@/components/leads-table";

type LeadsResponse = {
  leads: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
};

export default function LeadsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [appliedIndustry, setAppliedIndustry] = useState("");
  const [page, setPage] = useState(1);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [loading, startTransition] = useTransition();

  const fetchLeads = useCallback(() => {
    startTransition(async () => {
      setError("");

      try {
        const params = new URLSearchParams();
        if (appliedQ) params.set("q", appliedQ);
        if (appliedIndustry) params.set("industry", appliedIndustry);
        params.set("page", String(page));

        const response = await fetch(`/api/leads?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error ?? "Failed to load leads");
          return;
        }

        const result = data as LeadsResponse;
        setLeads(result.leads);
        setTotal(result.total);
        setPageSize(result.pageSize);
        setSelectedIds(new Set());
      } catch {
        setError("Failed to load leads. Check your connection and try again.");
      }
    });
  }, [appliedQ, appliedIndustry, page]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedQ(q.trim());
    setAppliedIndustry(industry.trim());
  }

  function handleToggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleToggleAll() {
    setSelectedIds((prev) => (prev.size === leads.length ? new Set() : new Set(leads.map((lead) => lead.id))));
  }

  function handleExport() {
    const params = new URLSearchParams();
    if (selectedIds.size > 0) {
      params.set("ids", Array.from(selectedIds).join(","));
    } else {
      if (appliedQ) params.set("q", appliedQ);
      if (appliedIndustry) params.set("industry", appliedIndustry);
    }
    window.location.href = `/api/leads/export?${params.toString()}`;
  }

  function handleAddToCampaign() {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds).join(",");
    router.push(`/campaigns?leadIds=${encodeURIComponent(ids)}`);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Leads</h1>
        <p className="text-sm text-zinc-500">Browse imported leads, filter, and export to CSV.</p>
      </div>

      <form
        onSubmit={handleFilterSubmit}
        className="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 bg-white p-6"
      >
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Search
          <input
            type="text"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Name, email, or company"
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

        <button type="submit" className="rounded bg-zinc-900 px-4 py-2 text-sm text-white">
          Filter
        </button>
      </form>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <LeadsTable
        leads={leads}
        selectedIds={selectedIds}
        onToggle={handleToggle}
        onToggleAll={handleToggleAll}
        onExport={handleExport}
        onAddToCampaign={handleAddToCampaign}
        loading={loading}
      />

      {leads.length > 0 ? (
        <div className="flex items-center justify-between text-sm text-zinc-600">
          <span>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border border-zinc-300 px-3 py-1.5 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded border border-zinc-300 px-3 py-1.5 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
