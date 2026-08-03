"use client";

import type { OutreachPlan } from "@/lib/assistant-plan";

type PlanCardProps = {
  plan: OutreachPlan;
  onApprove: () => void;
  approving: boolean;
  done?: boolean;
};

export function PlanCard({ plan, onApprove, approving, done }: PlanCardProps) {
  return (
    <div className="lf-card lf-rise overflow-hidden border-[color-mix(in_srgb,var(--signal)_35%,var(--line))]">
      <div className="border-b border-[var(--line)] bg-[linear-gradient(120deg,var(--signal-soft),transparent_60%)] px-5 py-4">
        <p className="lf-chip">Ready to run</p>
        <h3 className="lf-display mt-2 text-2xl font-semibold text-[var(--ink)]">{plan.campaign.name}</h3>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">{plan.summary}</p>
      </div>

      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Lead search</h4>
          <ul className="mt-2 space-y-1.5 text-sm text-[var(--ink-soft)]">
            {plan.search.q_keywords ? <li>Keywords: {plan.search.q_keywords}</li> : null}
            {plan.search.industry ? <li>Industry: {plan.search.industry}</li> : null}
            {(plan.search.person_titles?.length ?? 0) > 0 ? (
              <li>Titles: {plan.search.person_titles!.join(", ")}</li>
            ) : null}
            {(plan.search.person_locations?.length ?? 0) > 0 ? (
              <li>Locations: {plan.search.person_locations!.join(", ")}</li>
            ) : null}
            <li>Target count: {plan.search.targetCount ?? 10}</li>
          </ul>
        </section>

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Sequence</h4>
          <ol className="mt-2 space-y-2 text-sm text-[var(--ink-soft)]">
            {plan.campaign.steps.map((step, index) => (
              <li key={`${step.subject}-${index}`} className="rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2">
                <div className="font-semibold text-[var(--ink)]">
                  Day {step.delayDays}: {step.subject}
                </div>
                <div className="mt-1 line-clamp-3 text-xs text-[var(--muted)]">
                  {step.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-4">
        <p className="text-xs text-[var(--muted)]">
          Approving will enrich Apollo leads (credits), save contacts, create the campaign, and enroll them.
        </p>
        <button
          type="button"
          className="lf-btn lf-btn-primary shrink-0"
          onClick={onApprove}
          disabled={approving || done}
        >
          {done ? "Started" : approving ? "Starting…" : "Approve & start"}
        </button>
      </div>
    </div>
  );
}
