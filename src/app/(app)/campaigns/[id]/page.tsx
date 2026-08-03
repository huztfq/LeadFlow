"use client";

import { Suspense, useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CampaignForm, type StepDraft } from "@/components/campaign-form";
import { EnrollmentTable, type EnrollmentRow } from "@/components/enrollment-table";

type SendLogRow = {
  id: string;
  status: string;
  error: string | null;
  sentAt: string;
  stepOrder: number;
  leadEmail: string | null;
};

type CampaignDetail = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  steps: { id: string; stepOrder: number; delayDays: number; subject: string; bodyHtml: string }[];
  sendLogs: SendLogRow[];
  enrollments: EnrollmentRow[];
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
    return <p className="px-5 py-8 text-sm text-[var(--muted)]">Loading campaign…</p>;
  }

  if (loadError || !campaign) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-5 py-8 sm:px-8">
        <p className="lf-alert lf-alert-error">{loadError || "Campaign not found"}</p>
        <Link href="/campaigns" className="text-sm font-semibold text-[var(--signal-deep)] hover:underline">
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
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-5 py-6 sm:gap-6 sm:px-8 sm:py-8">
      <div className="lf-rise">
        <Link
          href="/campaigns"
          className="text-sm font-semibold text-[var(--signal-deep)] hover:underline"
        >
          ← Back to campaigns
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="lf-display text-3xl font-semibold text-[var(--ink)]">{campaign.name}</h1>
          <span className="lf-chip capitalize">{campaign.status}</span>
          {campaign.status === "active" ? (
            <button
              type="button"
              onClick={() => handleStatusChange("paused")}
              disabled={statusUpdating}
              className="lf-btn lf-btn-ghost !px-3 !py-1 text-xs"
            >
              {statusUpdating ? "Pausing…" : "Pause"}
            </button>
          ) : null}
          {campaign.status === "paused" ? (
            <button
              type="button"
              onClick={() => handleStatusChange("active")}
              disabled={statusUpdating}
              className="lf-btn lf-btn-ghost !px-3 !py-1 text-xs"
            >
              {statusUpdating ? "Resuming…" : "Resume"}
            </button>
          ) : null}
          {campaign.status === "active" || campaign.status === "paused" ? (
            <button
              type="button"
              onClick={() => handleStatusChange("completed")}
              disabled={statusUpdating}
              className="lf-btn lf-btn-ghost !px-3 !py-1 text-xs"
            >
              Mark completed
            </button>
          ) : null}
        </div>
      </div>

      {statusError ? <p className="lf-alert lf-alert-error">{statusError}</p> : null}

      {selectedLeadCount > 0 ? (
        <div className="lf-alert lf-alert-info flex flex-wrap items-center justify-between gap-3">
          <span>
            {selectedLeadCount} lead{selectedLeadCount === 1 ? "" : "s"} selected to enroll in this
            campaign.
          </span>
          <button
            type="button"
            onClick={handleEnroll}
            disabled={enrolling || campaign.status === "completed"}
            className="lf-btn lf-btn-primary !px-3 !py-1.5 text-xs"
          >
            {enrolling
              ? "Enrolling…"
              : `Enroll ${selectedLeadCount} lead${selectedLeadCount === 1 ? "" : "s"}`}
          </button>
        </div>
      ) : null}

      {enrollError ? <p className="lf-alert lf-alert-error">{enrollError}</p> : null}

      {enrollResult ? (
        <p className="lf-alert lf-alert-ok">
          Enrolled {enrollResult.enrolled} lead{enrollResult.enrolled === 1 ? "" : "s"}.
          {enrollResult.skippedAlreadyEnrolled > 0
            ? ` Skipped ${enrollResult.skippedAlreadyEnrolled} already enrolled.`
            : ""}
          {enrollResult.skippedNoEmail > 0
            ? ` Skipped ${enrollResult.skippedNoEmail} without an email.`
            : ""}
        </p>
      ) : null}

      {!isDraft ? (
        <p className="lf-alert lf-alert-warn">
          Steps can only be edited while a campaign is in draft status.
        </p>
      ) : null}

      {saved ? <p className="lf-alert lf-alert-ok">Campaign saved.</p> : null}

      <div className="lf-card p-6">
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

      <div className="flex flex-col gap-3">
        <h2 className="lf-display text-xl font-semibold text-[var(--ink)]">Enrollments</h2>
        <EnrollmentTable enrollments={campaign.enrollments} totalSteps={campaign.steps.length} />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="lf-display text-xl font-semibold text-[var(--ink)]">Recent sends</h2>
        {campaign.sendLogs.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No emails sent yet.</p>
        ) : (
          <div className="lf-table-wrap">
            <table className="lf-table">
              <thead>
                <tr>
                  <th>Sent at</th>
                  <th>Lead</th>
                  <th>Step</th>
                  <th>Status</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {campaign.sendLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap">{new Date(log.sentAt).toLocaleString()}</td>
                    <td>{log.leadEmail ?? "—"}</td>
                    <td>{log.stepOrder + 1}</td>
                    <td className="capitalize">{log.status}</td>
                    <td className="text-[var(--muted)]">{log.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CampaignDetailPage() {
  return (
    <Suspense fallback={<div className="px-5 py-8 text-sm text-[var(--muted)]">Loading…</div>}>
      <CampaignDetailContent />
    </Suspense>
  );
}
