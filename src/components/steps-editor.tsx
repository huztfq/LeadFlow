"use client";

export type StepDraft = {
  delayDays: number;
  subject: string;
  bodyHtml: string;
};

export function emptyStep(): StepDraft {
  return { delayDays: 0, subject: "", bodyHtml: "" };
}

type StepsEditorProps = {
  steps: StepDraft[];
  onChange: (steps: StepDraft[]) => void;
  disabled?: boolean;
};

export function StepsEditor({ steps, onChange, disabled = false }: StepsEditorProps) {
  function updateStep(index: number, patch: Partial<StepDraft>) {
    onChange(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }

  function removeStep(index: number) {
    onChange(steps.filter((_, i) => i !== index));
  }

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function addStep() {
    onChange([...steps, emptyStep()]);
  }

  return (
    <div className="flex flex-col gap-4">
      {steps.map((step, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-[14px] border border-[var(--line)] bg-white/70 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-[var(--ink)]">Step {index + 1}</span>
            {!disabled ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => moveStep(index, -1)}
                  disabled={index === 0}
                  className="lf-btn lf-btn-ghost !px-2.5 !py-1 text-xs"
                >
                  Move up
                </button>
                <button
                  type="button"
                  onClick={() => moveStep(index, 1)}
                  disabled={index === steps.length - 1}
                  className="lf-btn lf-btn-ghost !px-2.5 !py-1 text-xs"
                >
                  Move down
                </button>
                <button
                  type="button"
                  onClick={() => removeStep(index)}
                  disabled={steps.length <= 1}
                  className="lf-btn lf-btn-ghost !border-red-200 !px-2.5 !py-1 text-xs text-[var(--danger)]"
                >
                  Remove
                </button>
              </div>
            ) : null}
          </div>

          <label className="lf-label">
            Delay (days after previous step)
            <input
              type="number"
              min={0}
              value={step.delayDays}
              disabled={disabled}
              onChange={(event) => updateStep(index, { delayDays: Number(event.target.value) || 0 })}
              className="lf-input w-32 disabled:bg-[var(--paper)]"
            />
          </label>

          <label className="lf-label">
            Subject
            <input
              type="text"
              value={step.subject}
              disabled={disabled}
              onChange={(event) => updateStep(index, { subject: event.target.value })}
              placeholder="e.g. Quick question, {{firstName}}"
              className="lf-input disabled:bg-[var(--paper)]"
            />
          </label>

          <label className="lf-label">
            Body
            <textarea
              value={step.bodyHtml}
              disabled={disabled}
              onChange={(event) => updateStep(index, { bodyHtml: event.target.value })}
              rows={5}
              placeholder="Hi {{firstName}}, ..."
              className="lf-input font-mono text-sm disabled:bg-[var(--paper)]"
            />
          </label>
        </div>
      ))}

      {!disabled ? (
        <button type="button" onClick={addStep} className="lf-btn lf-btn-ghost self-start">
          Add step
        </button>
      ) : null}
    </div>
  );
}
