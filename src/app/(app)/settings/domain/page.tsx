"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { LoadingOverlay } from "@/components/loading-overlay";

const DEFAULT_DOMAIN_NAME = "inferfaform.com";

type ResendDomainRecord = {
  record: string;
  name: string;
  value: string;
  type: string;
  ttl: string;
  status: string;
  priority?: number;
};

type ResendDomain = {
  id: string;
  name: string;
  status: string;
  region: string;
  createdAt: string;
  openTracking?: boolean;
  clickTracking?: boolean;
};

type ResendDomainDetail = ResendDomain & {
  records: ResendDomainRecord[];
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "verified":
      return "bg-[var(--signal-soft)] text-[var(--signal-deep)]";
    case "partially_verified":
      return "bg-blue-50 text-blue-800";
    case "failed":
    case "partially_failed":
      return "bg-red-50 text-[var(--danger)]";
    case "pending":
    case "not_started":
    default:
      return "bg-amber-50 text-amber-900";
  }
}

function recordStatusBadgeClass(status: string): string {
  switch (status) {
    case "verified":
      return "bg-[var(--signal-soft)] text-[var(--signal-deep)]";
    case "failed":
    case "temporary_failure":
      return "bg-red-50 text-[var(--danger)]";
    case "pending":
    case "not_started":
    default:
      return "bg-amber-50 text-amber-900";
  }
}

export default function DomainSettingsPage() {
  const [domains, setDomains] = useState<ResendDomain[]>([]);
  const [selected, setSelected] = useState<ResendDomainDetail | null>(null);

  const [loadError, setLoadError] = useState("");
  const [loading, startLoadTransition] = useTransition();

  const [newName, setNewName] = useState(DEFAULT_DOMAIN_NAME);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createNote, setCreateNote] = useState("");

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  const [openTracking, setOpenTracking] = useState(false);
  const [clickTracking, setClickTracking] = useState(false);
  const [savingTracking, setSavingTracking] = useState(false);
  const [trackingError, setTrackingError] = useState("");

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState("");

  const fetchDomains = useCallback(() => {
    startLoadTransition(async () => {
      setLoadError("");
      try {
        const response = await fetch("/api/resend/domains");
        const data = await response.json();
        if (!response.ok) {
          setLoadError(data.error ?? "Failed to load domains");
          return;
        }
        setDomains(data.domains as ResendDomain[]);
      } catch {
        setLoadError("Failed to load domains. Check your connection and try again.");
      }
    });
  }, []);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  function selectDomain(detail: ResendDomainDetail) {
    setSelected(detail);
    setOpenTracking(Boolean(detail.openTracking));
    setClickTracking(Boolean(detail.clickTracking));
    setVerifyError("");
    setTrackingError("");
  }

  async function loadDetail(id: string) {
    setDetailLoading(true);
    setDetailError("");
    try {
      const response = await fetch(`/api/resend/domains/${id}`);
      const data = await response.json();
      if (!response.ok) {
        setDetailError(data.error ?? "Failed to load domain");
        return;
      }
      selectDomain(data.domain as ResendDomainDetail);
    } catch {
      setDetailError("Failed to load domain. Check your connection and try again.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim()) return;

    setCreating(true);
    setCreateError("");
    setCreateNote("");
    try {
      const response = await fetch("/api/resend/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setCreateError(data.error ?? "Failed to create domain");
        return;
      }
      if (data.alreadyExists) {
        setCreateNote(`${newName.trim()} is already on your Resend account — showing its current setup below.`);
      }
      selectDomain(data.domain as ResendDomainDetail);
      fetchDomains();
    } catch {
      setCreateError("Failed to create domain. Check your connection and try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleVerify() {
    if (!selected) return;
    setVerifying(true);
    setVerifyError("");
    try {
      const response = await fetch(`/api/resend/domains/${selected.id}/verify`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setVerifyError(data.error ?? "Failed to verify domain");
        return;
      }
      selectDomain(data.domain as ResendDomainDetail);
      fetchDomains();
    } catch {
      setVerifyError("Failed to verify domain. Check your connection and try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleSaveTracking() {
    if (!selected) return;
    setSavingTracking(true);
    setTrackingError("");
    try {
      const response = await fetch(`/api/resend/domains/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openTracking, clickTracking }),
      });
      const data = await response.json();
      if (!response.ok) {
        setTrackingError(data.error ?? "Failed to update tracking settings");
        return;
      }
      selectDomain(data.domain as ResendDomainDetail);
      fetchDomains();
    } catch {
      setTrackingError("Failed to update tracking settings. Check your connection and try again.");
    } finally {
      setSavingTracking(false);
    }
  }

  async function handleRemove(id: string) {
    if (!window.confirm("Remove this domain from Resend? This can't be undone.")) return;
    setRemovingId(id);
    setRemoveError("");
    try {
      const response = await fetch(`/api/resend/domains/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        setRemoveError(data.error ?? "Failed to remove domain");
        return;
      }
      if (selected?.id === id) setSelected(null);
      fetchDomains();
    } catch {
      setRemoveError("Failed to remove domain. Check your connection and try again.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 py-6 sm:gap-6 sm:px-8 sm:py-8">
      <div className="lf-rise">
        <p className="lf-chip">Resend · domains</p>
        <h1 className="lf-display mt-2 text-3xl font-semibold text-[var(--ink)]">Domain</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Add and verify sending domains on your Resend account, then point{" "}
          <code className="rounded bg-[var(--paper)] px-1 py-0.5 text-[var(--ink)]">RESEND_FROM_EMAIL</code>{" "}
          at a verified address, e.g. <code className="rounded bg-[var(--paper)] px-1 py-0.5 text-[var(--ink)]">
            Leadflow &lt;hello@{DEFAULT_DOMAIN_NAME}&gt;
          </code>
          .
        </p>
      </div>

      {loadError ? <p className="lf-alert lf-alert-error">{loadError}</p> : null}
      {removeError ? <p className="lf-alert lf-alert-error">{removeError}</p> : null}

      <div className="lf-card p-6">
        <h2 className="mb-4 text-sm font-semibold text-[var(--ink)]">Add a domain</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="lf-label flex-1">
            Domain name
            <input
              type="text"
              value={newName}
              disabled={creating}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={DEFAULT_DOMAIN_NAME}
              className="lf-input disabled:bg-[var(--paper)]"
            />
          </label>
          <button type="submit" disabled={creating || !newName.trim()} className="lf-btn lf-btn-primary">
            {creating ? "Adding…" : "Add domain"}
          </button>
          {newName.trim() !== DEFAULT_DOMAIN_NAME ? (
            <button
              type="button"
              disabled={creating}
              onClick={() => setNewName(DEFAULT_DOMAIN_NAME)}
              className="lf-btn lf-btn-ghost"
            >
              Use {DEFAULT_DOMAIN_NAME}
            </button>
          ) : null}
        </form>
        {createError ? <p className="lf-alert lf-alert-error mt-4">{createError}</p> : null}
        {createNote ? <p className="lf-alert lf-alert-info mt-4">{createNote}</p> : null}
      </div>

      <div className="lf-card relative overflow-hidden">
        <div className="border-b border-[var(--line)] px-6 py-3">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Domains on this account</h2>
        </div>
        {loading ? (
          <div className="relative min-h-[140px]">
            <LoadingOverlay label="Loading domains…" />
          </div>
        ) : domains.length === 0 ? (
          <p className="px-6 py-4 text-sm text-[var(--muted)]">No domains yet. Add one above.</p>
        ) : (
          <div className="lf-table-wrap !rounded-none !border-0 !shadow-none">
            <table className="lf-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Region</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {domains.map((domain) => (
                  <tr key={domain.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => loadDetail(domain.id)}
                        className="font-semibold text-[var(--signal-deep)] hover:underline"
                      >
                        {domain.name}
                      </button>
                    </td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(domain.status)}`}
                      >
                        {domain.status}
                      </span>
                    </td>
                    <td>{domain.region}</td>
                    <td>{new Date(domain.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => loadDetail(domain.id)}
                          disabled={detailLoading}
                          className="lf-btn lf-btn-ghost !px-3 !py-1.5 text-xs"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(domain.id)}
                          disabled={removingId === domain.id}
                          className="lf-btn lf-btn-ghost !px-3 !py-1.5 text-xs text-[var(--danger)]"
                        >
                          {removingId === domain.id ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailError ? <p className="lf-alert lf-alert-error">{detailError}</p> : null}

      {selected ? (
        <div className="lf-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--ink)]">{selected.name}</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Region: {selected.region} · Created {new Date(selected.createdAt).toLocaleString()}
              </p>
            </div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(selected.status)}`}
            >
              {selected.status}
            </span>
          </div>

          {selected.status !== "verified" ? (
            <p className="lf-alert lf-alert-warn mb-4">
              Add the DNS records below at your domain registrar, then verify. Verification can take a
              few minutes to propagate.
            </p>
          ) : (
            <p className="lf-alert lf-alert-ok mb-4">
              Verified. You can now send from an address on this domain, e.g. set{" "}
              <code>RESEND_FROM_EMAIL=&quot;Leadflow &lt;hello@{selected.name}&gt;&quot;</code>.
            </p>
          )}

          <div className="mb-5 flex items-center gap-3">
            <button type="button" onClick={handleVerify} disabled={verifying} className="lf-btn lf-btn-primary">
              {verifying ? "Verifying…" : "Verify domain"}
            </button>
            {verifyError ? <p className="text-sm text-[var(--danger)]">{verifyError}</p> : null}
          </div>

          <h3 className="mb-2 text-sm font-semibold text-[var(--ink)]">DNS records</h3>
          {selected.records.length === 0 ? (
            <p className="mb-5 text-sm text-[var(--muted)]">No DNS records returned for this domain.</p>
          ) : (
            <div className="lf-table-wrap mb-5">
              <table className="lf-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Value</th>
                    <th>TTL</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.records.map((record, index) => (
                    <tr key={`${record.record}-${index}`}>
                      <td>{record.type}</td>
                      <td className="max-w-xs break-all">{record.name}</td>
                      <td className="max-w-md break-all">{record.value}</td>
                      <td>{record.ttl}</td>
                      <td>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${recordStatusBadgeClass(record.status)}`}
                        >
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="mb-2 text-sm font-semibold text-[var(--ink)]">Tracking</h3>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
              <input
                type="checkbox"
                checked={openTracking}
                onChange={(event) => setOpenTracking(event.target.checked)}
              />
              Open tracking
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
              <input
                type="checkbox"
                checked={clickTracking}
                onChange={(event) => setClickTracking(event.target.checked)}
              />
              Click tracking
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveTracking}
                disabled={savingTracking}
                className="lf-btn lf-btn-ghost self-start"
              >
                {savingTracking ? "Saving…" : "Save tracking settings"}
              </button>
              {trackingError ? <p className="text-sm text-[var(--danger)]">{trackingError}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
