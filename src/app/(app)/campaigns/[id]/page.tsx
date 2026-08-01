"use client";

import { Suspense, useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { CampaignForm, type StepDraft } from "@/components/campaign-form";

type CampaignDetail = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  steps: { id: string; stepOrder: number; delayDays: number; subject: string; bodyHtml: string }[];
};

function CampaignDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const leadIds = searchParams.get("leadIds") ?? "";
  const selectedLeadCount = leadIds ? leadIds.split(",").filter(Boolean).length : 0;

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, startLoadTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const fetchCampaign = useCallback(() => {
    startLoadTransition(async () => {
      setLoadError("");
      try {
        const response = await fetch(`/api/campaigns/${params.id}`);
        const data = await response.json();
        if (!response.ok) {
          setLoadError(data.error ?? "Failed to load campaign");
          return;
        }
        setCampaign(data.campaign as CampaignDetail);
      } catch {
        setLoadError("Failed to load campaign. Check your connection and try again.");
      }
    });
  }, [params.id]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  async function handleSave(data: { name: string; steps: StepDraft[] }) {
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      const response = await fetch(`/api/campaigns/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        setSaveError(result.error ?? "Failed to save campaign");
        return;
      }
      setCampaign(result.campaign as CampaignDetail);
      setSaved(true);
    } catch {
      setSaveError("Failed to save campaign. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="px-6 py-8 text-sm text-zinc-500">Loading campaign…</p>;
  }

  if (loadError || !campaign) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-6 py-8">
        <p className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {loadError || "Campaign not found"}
        </p>
        <Link href="/campaigns" className="text-sm text-blue-700 hover:underline">
          Back to campaigns
        </Link>
      </div>
    );
  }

  const isDraft = campaign.status === "draft";
  const initialSteps: StepDraft[] = campaign.steps
    .slice()
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((step) => ({ delayDays: step.delayDays, subject: step.subject, bodyHtml: step.bodyHtml }));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <Link href="/campaigns" className="text-sm text-blue-700 hover:underline">
          ← Back to campaigns
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900">{campaign.name}</h1>
          <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs capitalize text-zinc-600">
            {campaign.status}
          </span>
        </div>
      </div>

      {selectedLeadCount > 0 ? (
        <p className="rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
          {selectedLeadCount} lead{selectedLeadCount === 1 ? "" : "s"} selected to enroll in this campaign.
        </p>
      ) : null}

      {!isDraft ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Steps can only be edited while a campaign is in draft status.
        </p>
      ) : null}

      {saved ? (
        <p className="rounded border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          Campaign saved.
        </p>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <CampaignForm
          initialName={campaign.name}
          initialSteps={initialSteps}
          submitLabel="Save changes"
          submitting={saving}
          error={saveError}
          disabled={!isDraft}
          onSubmit={handleSave}
        />
      </div>
    </div>
  );
}

export default function CampaignDetailPage() {
  return (
    <Suspense fallback={<div className="px-6 py-8 text-sm text-zinc-500">Loading…</div>}>
      <CampaignDetailContent />
    </Suspense>
  );
}
