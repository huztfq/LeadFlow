"use client";

import type { ApolloPerson } from "@/lib/import-leads";

function personKey(person: ApolloPerson, index: number): string {
  return person.id ?? person.email ?? `row-${index}`;
}

function personLocation(person: ApolloPerson): string {
  return [person.city, person.state, person.country].filter(Boolean).join(", ") || "—";
}

function displayLastName(person: ApolloPerson): string {
  return person.last_name || person.last_name_obfuscated || "";
}

function hasEmailFlag(person: ApolloPerson): boolean {
  return Boolean(person.has_email) || Boolean(person.email);
}

function hasPhoneFlag(person: ApolloPerson): boolean {
  const flag = person.has_direct_phone;
  return flag === true || flag === "Yes" || flag === "yes" || Boolean(person.phone_numbers?.length);
}

type PeopleResultsTableProps = {
  people: ApolloPerson[];
  selectedKeys: Set<string>;
  onToggle: (key: string) => void;
  onToggleAll: () => void;
  onEnrichImport: () => void;
  importing: boolean;
};

export function PeopleResultsTable({
  people,
  selectedKeys,
  onToggle,
  onToggleAll,
  onEnrichImport,
  importing,
}: PeopleResultsTableProps) {
  const allSelected = people.length > 0 && selectedKeys.size === people.length;
  const selectedWithId = people.filter(
    (person, index) => selectedKeys.has(personKey(person, index)) && Boolean(person.id),
  ).length;

  if (people.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">No results yet. Run a search to see people here.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[var(--muted)]">
          <p>
            {selectedKeys.size} of {people.length} selected
            {selectedWithId > 0 ? ` · ${selectedWithId} ready to enrich` : null}
          </p>
          <p className="text-xs">
            Search does not return emails. Use Enrich &amp; import (uses Apollo credits) to reveal
            and save to Contacts.
          </p>
        </div>
        <button
          type="button"
          onClick={onEnrichImport}
          disabled={importing || selectedWithId === 0}
          className="lf-btn lf-btn-primary"
        >
          {importing ? "Enriching & importing…" : "Enrich & import selected"}
        </button>
      </div>

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
              <th>Title</th>
              <th>Company</th>
              <th>Has email</th>
              <th>Has phone</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person, index) => {
              const key = personKey(person, index);
              const name =
                [person.first_name, displayLastName(person)].filter(Boolean).join(" ") || "—";
              return (
                <tr
                  key={key}
                  className={!hasEmailFlag(person) ? "bg-[var(--paper)]/60" : undefined}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(key)}
                      onChange={() => onToggle(key)}
                      disabled={!person.id}
                      className="h-4 w-4 accent-[var(--signal)]"
                    />
                  </td>
                  <td>{name}</td>
                  <td>{person.title ?? "—"}</td>
                  <td>{person.organization?.name ?? "—"}</td>
                  <td>{hasEmailFlag(person) ? "Yes" : "No"}</td>
                  <td>{hasPhoneFlag(person) ? "Yes" : "No"}</td>
                  <td>{personLocation(person)}</td>
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
