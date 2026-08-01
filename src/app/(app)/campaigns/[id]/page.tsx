"use client";

import { Suspense, useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CampaignForm, type StepDraft } from "@/components/campaign-form";

type CampaignDetail = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  steps: { id: string; stepOrder: number; delayDays: number; subject: string; bodyHtml: string }[];
};

type EnrollResult = { enrolled: number; skippedAlreadyEnrolled: number; skippedNoEmail: number };

function CampaignDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadIds = searchParams.get("leadIds") ?? "";
  const leadIdList = leadIds ? leadIds.split(",").filter(Boolean) : [];
  const selectedLeadCount = leadIdList.length;

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, startLoadTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState("");
  const [enrollResult, setEnrollResult] = useState<EnrollResult | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState("");

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

  async function handleEnroll() {
    if (leadIdList.length === 0) return;
    setEnrolling(true);
    setEnrollError("");
    setEnrollResult(null);
    try {
      const response = await fetch(`/api/campaigns/${params.id}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: leadIdList }),
      });
      const result = await response.json();
      if (!response.ok) {
        setEnrollError(result.error ?? "Failed to enroll leads");
        return;
      }
      setEnrollResult(result as EnrollResult);
      router.replace(`/campaigns/${params.id}`);
      fetchCampaign();
    } catch {
      setEnrollError("Failed to enroll leads. Check your connection and try again.");
    } finally {
      setEnrolling(false);
    }
  }

  async function handleStatusChange(status: "active" | "paused" | "completed") {
    setStatusUpdating(true);
    setStatusError("");
    try {
      const response = await fetch(`/api/campaigns/${params.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) {
        setStatusError(result.error ?? "Failed to update campaign status");
        return;
      }
      setCampaign(result.campaign as CampaignDetail);
    } catch {
      setStatusError("Failed to update campaign status. Check your connection and try again.");
    } finally {
      setStatusUpdating(false);
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
          {campaign.status === "active" ? (
            <button
              type="button"
              onClick={() => handleStatusChange("paused")}
              disabled={statusUpdating}
              className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              {statusUpdating ? "Pausing…" : "Pause"}
            </button>
          ) : null}
          {campaign.status === "paused" ? (
            <button
              type="button"
              onClick={() => handleStatusChange("active")}
              disabled={statusUpdating}
              className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              {statusUpdating ? "Resuming…" : "Resume"}
            </button>
          ) : null}
          {campaign.status === "active" || campaign.status === "paused" ? (
            <button
              type="button"
              onClick={() => handleStatusChange("completed")}
              disabled={statusUpdating}
              className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Mark completed
            </button>
          ) : null}
        </div>
      </div>

      {statusError ? (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{statusError}</p>
      ) : null}

      {selectedLeadCount > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
          <span>
            {selectedLeadCount} lead{selectedLeadCount === 1 ? "" : "s"} selected to enroll in this campaign.
          </span>
          <button
            type="button"
            onClick={handleEnroll}
            disabled={enrolling || campaign.status === "completed"}
            className="shrink-0 rounded bg-zinc-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
          >
            {enrolling ? "Enrolling…" : `Enroll ${selectedLeadCount} lead${selectedLeadCount === 1 ? "" : "s"}`}
          </button>
        </div>
      ) : null}

      {enrollError ? (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{enrollError}</p>
      ) : null}

      {enrollResult ? (
        <p className="rounded border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          Enrolled {enrollResult.enrolled} lead{enrollResult.enrolled === 1 ? "" : "s"}.
          {enrollResult.skippedAlreadyEnrolled > 0
            ? ` Skipped ${enrollResult.skippedAlreadyEnrolled} already enrolled.`
            : ""}
          {enrollResult.skippedNoEmail > 0 ? ` Skipped ${enrollResult.skippedNoEmail} without an email.` : ""}
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
