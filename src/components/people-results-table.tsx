"use client";

import type { ApolloPerson } from "@/lib/import-leads";

function personKey(person: ApolloPerson, index: number): string {
  return person.id ?? person.email ?? `row-${index}`;
}

function personLocation(person: ApolloPerson): string {
  return [person.city, person.state, person.country].filter(Boolean).join(", ") || "—";
}

type PeopleResultsTableProps = {
  people: ApolloPerson[];
  selectedKeys: Set<string>;
  onToggle: (key: string) => void;
  onToggleAll: () => void;
  onImportSelected: () => void;
  importing: boolean;
};

export function PeopleResultsTable({
  people,
  selectedKeys,
  onToggle,
  onToggleAll,
  onImportSelected,
  importing,
}: PeopleResultsTableProps) {
  const allSelected = people.length > 0 && selectedKeys.size === people.length;

  if (people.length === 0) {
    return <p className="text-sm text-zinc-500">No results yet. Run a search to see people here.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-600">
          {selectedKeys.size} of {people.length} selected
        </span>
        <button
          type="button"
          onClick={onImportSelected}
          disabled={importing || selectedKeys.size === 0}
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {importing ? "Importing…" : "Import selected"}
        </button>
      </div>

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
              <th className="px-3 py-2">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-zinc-900">
            {people.map((person, index) => {
              const key = personKey(person, index);
              const name = [person.first_name, person.last_name].filter(Boolean).join(" ") || "—";
              return (
                <tr key={key}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(key)}
                      onChange={() => onToggle(key)}
                    />
                  </td>
                  <td className="px-3 py-2">{name}</td>
                  <td className="px-3 py-2">{person.title ?? "—"}</td>
                  <td className="px-3 py-2">{person.organization?.name ?? "—"}</td>
                  <td className="px-3 py-2">{person.email ?? "—"}</td>
                  <td className="px-3 py-2">{personLocation(person)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { personKey };
