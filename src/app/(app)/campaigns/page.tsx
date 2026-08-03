"use client";

import { Suspense, useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CampaignForm, type StepDraft } from "@/components/campaign-form";

type CampaignSummary = {
  id: string;
  name: string;
  status: string;
  stepCount: number;
  createdAt: string;
};

function CampaignsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadIds = searchParams.get("leadIds") ?? "";
  const selectedLeadCount = leadIds ? leadIds.split(",").filter(Boolean).length : 0;

  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, startLoadTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchCampaigns = useCallback(() => {
    startLoadTransition(async () => {
      setLoadError("");
      try {
        const response = await fetch("/api/campaigns");
        const data = await response.json();
        if (!response.ok) {
          setLoadError(data.error ?? "Failed to load campaigns");
          return;
        }
        setCampaigns(data.campaigns as CampaignSummary[]);
      } catch {
        setLoadError("Failed to load campaigns. Check your connection and try again.");
      }
    });
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  function campaignHref(id: string): string {
    return leadIds ? `/campaigns/${id}?leadIds=${encodeURIComponent(leadIds)}` : `/campaigns/${id}`;
  }

  async function handleCreate(data: { name: string; steps: StepDraft[] }) {
    setCreating(true);
    setCreateError("");
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        setCreateError(result.error ?? "Failed to create campaign");
        return;
      }
      router.push(campaignHref(result.campaign.id));
    } catch {
      setCreateError("Failed to create campaign. Check your connection and try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 py-6 sm:gap-6 sm:px-8 sm:py-8">
      <div className="lf-rise">
        <p className="lf-chip">Resend · cron</p>
        <h1 className="lf-display mt-2 text-3xl font-semibold text-[var(--ink)]">Campaigns</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Build multi-step sequences, enroll contacts, and let the worker send on schedule.
        </p>
      </div>

      {selectedLeadCount > 0 ? (
        <p className="lf-alert lf-alert-info">
          {selectedLeadCount} lead{selectedLeadCount === 1 ? "" : "s"} selected — open a campaign below or
          create a new one to enroll them.
        </p>
      ) : null}

      {loadError ? <p className="lf-alert lf-alert-error">{loadError}</p> : null}

      <div className="lf-card overflow-hidden">
        <div className="border-b border-[var(--line)] px-6 py-3">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Existing campaigns</h2>
        </div>
        {loading ? (
          <p className="px-6 py-4 text-sm text-[var(--muted)]">Loading campaigns…</p>
        ) : campaigns.length === 0 ? (
          <p className="px-6 py-4 text-sm text-[var(--muted)]">No campaigns yet. Create one below.</p>
        ) : (
          <div className="lf-table-wrap !rounded-none !border-0 !shadow-none">
            <table className="lf-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Steps</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>
                      <Link href={campaignHref(campaign.id)}>{campaign.name}</Link>
                    </td>
                    <td className="capitalize">{campaign.status}</td>
                    <td>{campaign.stepCount}</td>
                    <td>{new Date(campaign.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="lf-card p-6">
        <h2 className="mb-4 text-sm font-semibold text-[var(--ink)]">Create a new campaign</h2>
        <CampaignForm
          submitLabel="Create campaign"
          submitting={creating}
          error={createError}
          onSubmit={handleCreate}
        />
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={<div className="px-5 py-8 text-sm text-[var(--muted)]">Loading…</div>}>
      <CampaignsPageContent />
    </Suspense>
  );
}
