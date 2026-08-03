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
  importedAt?: string;
  status?: string;
  statusDetail?: string;
  campaignCount?: number;
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

function statusBadgeClass(status: string | undefined): string {
  switch (status) {
    case "in_campaign":
    case "active":
      return "bg-blue-50 text-blue-800";
    case "completed":
      return "bg-[var(--signal-soft)] text-[var(--signal-deep)]";
    case "unsubscribed":
      return "bg-[var(--paper)] text-[var(--muted)]";
    case "failed":
    case "bounced":
      return "bg-red-50 text-[var(--danger)]";
    case "new":
    default:
      return "bg-amber-50 text-amber-900";
  }
}

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-[var(--muted)]">
          {selectedIds.size} of {leads.length} selected
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onExport}
            disabled={loading || leads.length === 0}
            className="lf-btn lf-btn-ghost"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={onAddToCampaign}
            disabled={selectedIds.size === 0}
            className="lf-btn lf-btn-primary"
          >
            Add to campaign
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading contacts…</p>
      ) : leads.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No contacts yet. Search Apollo and use Enrich &amp; import to save people here.
        </p>
      ) : (
        <div className="lf-table-wrap">
          <table className="lf-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleAll}
                    className="h-4 w-4 accent-[var(--signal)]"
                  />
                </th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Company</th>
                <th>Title</th>
                <th>Status</th>
                <th>Imported</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "—";
                const imported =
                  lead.importedAt != null
                    ? new Date(lead.importedAt).toLocaleDateString()
                    : "—";
                return (
                  <tr key={lead.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => onToggle(lead.id)}
                        className="h-4 w-4 accent-[var(--signal)]"
                      />
                    </td>
                    <td>{name}</td>
                    <td>{lead.email ?? "—"}</td>
                    <td>{lead.phone ?? "—"}</td>
                    <td>{lead.company ?? "—"}</td>
                    <td>{lead.title ?? "—"}</td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(lead.status)}`}
                        title={lead.statusDetail}
                      >
                        {lead.statusDetail ?? lead.status ?? "new"}
                      </span>
                    </td>
                    <td className="text-[var(--muted)]">{imported}</td>
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
