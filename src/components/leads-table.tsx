"use client";

export type LeadRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  title: string | null;
  company: string | null;
  industry: string | null;
  location: string | null;
  phone: string | null;
};

type LeadsTableProps = {
  leads: LeadRow[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onExport: () => void;
  onAddToCampaign: () => void;
  loading: boolean;
};

export function LeadsTable({
  leads,
  selectedIds,
  onToggle,
  onToggleAll,
  onExport,
  onAddToCampaign,
  loading,
}: LeadsTableProps) {
  const allSelected = leads.length > 0 && selectedIds.size === leads.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-600">
          {selectedIds.size} of {leads.length} selected
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onExport}
            disabled={loading || leads.length === 0}
            className="rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={onAddToCampaign}
            disabled={selectedIds.size === 0}
            className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Add to campaign
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading leads…</p>
      ) : leads.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No leads found. Try adjusting your filters or import leads from Search.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2">
                  <input type="checkbox" checked={allSelected} onChange={onToggleAll} />
                </th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Industry</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-900">
              {leads.map((lead) => {
                const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "—";
                return (
                  <tr key={lead.id}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => onToggle(lead.id)}
                      />
                    </td>
                    <td className="px-3 py-2">{name}</td>
                    <td className="px-3 py-2">{lead.title ?? "—"}</td>
                    <td className="px-3 py-2">{lead.company ?? "—"}</td>
                    <td className="px-3 py-2">{lead.email ?? "—"}</td>
                    <td className="px-3 py-2">{lead.industry ?? "—"}</td>
                    <td className="px-3 py-2">{lead.location ?? "—"}</td>
                    <td className="px-3 py-2">{lead.phone ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
