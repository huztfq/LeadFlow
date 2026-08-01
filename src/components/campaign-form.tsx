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
      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Campaign name
        <input
          type="text"
          value={name}
          disabled={disabled}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Q3 Dentist Outreach"
          className="rounded border border-zinc-300 px-3 py-2 text-zinc-900 disabled:bg-zinc-100"
        />
      </label>

      <div>
        <h3 className="mb-3 text-sm font-medium text-zinc-900">Sequence steps</h3>
        <StepsEditor steps={steps} onChange={setSteps} disabled={disabled} />
      </div>

      {displayError ? (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{displayError}</p>
      ) : null}

      {!disabled ? (
        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
      ) : null}
    </form>
  );
}
