"use client";

import { useState, type FormEvent } from "react";
import { StepsEditor, emptyStep, type StepDraft } from "@/components/steps-editor";

export type { StepDraft } from "@/components/steps-editor";

type CampaignFormProps = {
  initialName?: string;
  initialSteps?: StepDraft[];
  submitLabel: string;
  submitting?: boolean;
  error?: string;
  disabled?: boolean;
  onSubmit: (data: { name: string; steps: StepDraft[] }) => void;
};

function validate(name: string, steps: StepDraft[]): string {
  if (!name.trim()) return "Campaign name is required.";
  if (steps.length === 0) return "At least one step is required.";
  for (const step of steps) {
    if (step.delayDays < 0) return "Delay days must be 0 or greater.";
    if (!step.subject.trim()) return "Every step needs a subject.";
    if (!step.bodyHtml.trim()) return "Every step needs a body.";
  }
  return "";
}

export function CampaignForm({
  initialName = "",
  initialSteps,
  submitLabel,
  submitting = false,
  error = "",
  disabled = false,
  onSubmit,
}: CampaignFormProps) {
  const [name, setName] = useState(initialName);
  const [steps, setSteps] = useState<StepDraft[]>(initialSteps?.length ? initialSteps : [emptyStep()]);
  const [validationError, setValidationError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = validate(name, steps);
    setValidationError(message);
    if (message) return;
    onSubmit({ name: name.trim(), steps });
  }

  const displayError = validationError || error;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <label className="lf-label">
        Campaign name
        <input
          type="text"
          value={name}
          disabled={disabled}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Q3 Dentist Outreach"
          className="lf-input disabled:bg-[var(--paper)]"
        />
      </label>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-[var(--ink)]">Sequence steps</h3>
        <StepsEditor steps={steps} onChange={setSteps} disabled={disabled} />
      </div>

      {displayError ? <p className="lf-alert lf-alert-error">{displayError}</p> : null}

      {!disabled ? (
        <button type="submit" disabled={submitting} className="lf-btn lf-btn-primary self-start">
          {submitting ? "Saving…" : submitLabel}
        </button>
      ) : null}
    </form>
  );
}
