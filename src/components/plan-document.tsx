"use client";

import { emptyOutreachStep, type OutreachPlan } from "@/lib/assistant-plan";

type PlanUpdater = (updater: (plan: OutreachPlan) => OutreachPlan) => void;

/**
 * Editable, non-canvas view of a plan: filters + the email sequence as a plain document.
 * Used as a fallback whenever the ReactFlow canvas can't render (e.g. a render error), so the
 * artifact panel is never blank while Approve & start is showing.
 */
export function PlanDocument({ plan, onPlanChange }: { plan: OutreachPlan; onPlanChange: PlanUpdater }) {
  function updateStep(index: number, patch: Partial<OutreachPlan["campaign"]["steps"][number]>) {
    onPlanChange((current) => ({
      ...current,
      campaign: {
        ...current.campaign,
        steps: current.campaign.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
      },
    }));
  }

  function removeStep(index: number) {
    onPlanChange((current) => {
      if (current.campaign.steps.length <= 1) return current;
      return {
        ...current,
        campaign: { ...current.campaign, steps: current.campaign.steps.filter((_, i) => i !== index) },
      };
    });
  }

  function addStep() {
    onPlanChange((current) => ({
      ...current,
      campaign: { ...current.campaign, steps: [...current.campaign.steps, emptyOutreachStep()] },
    }));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div className="lf-card flex flex-col gap-3 p-4">
        <h3 className="text-sm font-semibold text-[var(--ink)]">Lead search</h3>
        <label className="lf-inspector-field">
          Job titles (comma separated)
          <input
            className="lf-input"
            value={(plan.search.person_titles ?? []).join(", ")}
            onChange={(event) =>
              onPlanChange((current) => ({
                ...current,
                search: {
                  ...current.search,
                  person_titles: event.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              }))
            }
          />
        </label>
        <label className="lf-inspector-field">
          Locations (comma separated)
          <input
            className="lf-input"
            value={(plan.search.person_locations ?? []).join(", ")}
            onChange={(event) =>
              onPlanChange((current) => ({
                ...current,
                search: {
                  ...current.search,
                  person_locations: event.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              }))
            }
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="lf-inspector-field">
            Industry
            <input
              className="lf-input"
              value={plan.search.industry ?? ""}
              onChange={(event) =>
                onPlanChange((current) => ({
                  ...current,
                  search: { ...current.search, industry: event.target.value },
                }))
              }
            />
          </label>
          <label className="lf-inspector-field">
            Keywords
            <input
              className="lf-input"
              value={plan.search.q_keywords ?? ""}
              onChange={(event) =>
                onPlanChange((current) => ({
                  ...current,
                  search: { ...current.search, q_keywords: event.target.value },
                }))
              }
            />
          </label>
        </div>
        <label className="lf-inspector-field">
          Target count (1–30)
          <input
            type="number"
            min={1}
            max={30}
            className="lf-input w-28"
            value={plan.search.targetCount ?? 10}
            onChange={(event) =>
              onPlanChange((current) => ({
                ...current,
                search: {
                  ...current.search,
                  targetCount: Math.min(30, Math.max(1, Number(event.target.value) || 1)),
                },
              }))
            }
          />
        </label>
      </div>

      <div className="lf-card flex flex-col gap-3 p-4">
        <h3 className="text-sm font-semibold text-[var(--ink)]">Campaign</h3>
        <label className="lf-inspector-field">
          Campaign name
          <input
            className="lf-input"
            value={plan.campaign.name}
            onChange={(event) =>
              onPlanChange((current) => ({
                ...current,
                campaign: { ...current.campaign, name: event.target.value },
              }))
            }
          />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[var(--ink)]">Email sequence</h3>
        {plan.campaign.steps.map((step, index) => (
          <div key={index} className="lf-card flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="lf-chip">
                Step {index + 1} · {step.delayDays === 0 ? "Send immediately" : `Day ${step.delayDays}`}
              </span>
              <button
                type="button"
                className="lf-btn lf-btn-ghost !border-red-200 !px-2.5 !py-1 text-xs text-[var(--danger)]"
                onClick={() => removeStep(index)}
                disabled={plan.campaign.steps.length <= 1}
              >
                Remove
              </button>
            </div>
            <label className="lf-inspector-field">
              Delay (days after previous step)
              <input
                type="number"
                min={0}
                className="lf-input w-32"
                value={step.delayDays}
                onChange={(event) => updateStep(index, { delayDays: Number(event.target.value) || 0 })}
              />
            </label>
            <label className="lf-inspector-field">
              Subject
              <input
                className="lf-input"
                value={step.subject}
                onChange={(event) => updateStep(index, { subject: event.target.value })}
              />
            </label>
            <label className="lf-inspector-field">
              Body (HTML)
              <textarea
                className="lf-input font-mono text-sm"
                rows={4}
                value={step.bodyHtml}
                onChange={(event) => updateStep(index, { bodyHtml: event.target.value })}
              />
            </label>
          </div>
        ))}
        <button type="button" className="lf-node-add self-start" onClick={addStep}>
          + Add email step
        </button>
      </div>
    </div>
  );
}
