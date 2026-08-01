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
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Campaigns</h1>
        <p className="text-sm text-zinc-500">Create outreach sequences and manage their steps.</p>
      </div>

      {selectedLeadCount > 0 ? (
        <p className="rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
          {selectedLeadCount} lead{selectedLeadCount === 1 ? "" : "s"} selected — open a campaign below or create a
          new one to enroll them.
        </p>
      ) : null}

      {loadError ? (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{loadError}</p>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-6 py-3">
          <h2 className="text-sm font-medium text-zinc-900">Existing campaigns</h2>
        </div>
        {loading ? (
          <p className="px-6 py-4 text-sm text-zinc-500">Loading campaigns…</p>
        ) : campaigns.length === 0 ? (
          <p className="px-6 py-4 text-sm text-zinc-500">No campaigns yet. Create one below.</p>
        ) : (
          <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-6 py-2">Name</th>
                <th className="px-6 py-2">Status</th>
                <th className="px-6 py-2">Steps</th>
                <th className="px-6 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-900">
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td className="px-6 py-2">
                    <Link href={campaignHref(campaign.id)} className="text-blue-700 hover:underline">
                      {campaign.name}
                    </Link>
                  </td>
                  <td className="px-6 py-2 capitalize">{campaign.status}</td>
                  <td className="px-6 py-2">{campaign.stepCount}</td>
                  <td className="px-6 py-2">{new Date(campaign.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-zinc-900">Create a new campaign</h2>
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
    <Suspense fallback={<div className="px-6 py-8 text-sm text-zinc-500">Loading…</div>}>
      <CampaignsPageContent />
    </Suspense>
  );
}
