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
        <div key={index} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-900">Step {index + 1}</span>
            {!disabled ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => moveStep(index, -1)}
                  disabled={index === 0}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Move up
                </button>
                <button
                  type="button"
                  onClick={() => moveStep(index, 1)}
                  disabled={index === steps.length - 1}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Move down
                </button>
                <button
                  type="button"
                  onClick={() => removeStep(index)}
                  disabled={steps.length <= 1}
                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ) : null}
          </div>

          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Delay (days after previous step)
            <input
              type="number"
              min={0}
              value={step.delayDays}
              disabled={disabled}
              onChange={(event) => updateStep(index, { delayDays: Number(event.target.value) || 0 })}
              className="w-32 rounded border border-zinc-300 px-3 py-2 text-zinc-900 disabled:bg-zinc-100"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Subject
            <input
              type="text"
              value={step.subject}
              disabled={disabled}
              onChange={(event) => updateStep(index, { subject: event.target.value })}
              placeholder="e.g. Quick question, {{firstName}}"
              className="rounded border border-zinc-300 px-3 py-2 text-zinc-900 disabled:bg-zinc-100"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Body
            <textarea
              value={step.bodyHtml}
              disabled={disabled}
              onChange={(event) => updateStep(index, { bodyHtml: event.target.value })}
              rows={5}
              placeholder="Hi {{firstName}}, ..."
              className="rounded border border-zinc-300 px-3 py-2 font-mono text-sm text-zinc-900 disabled:bg-zinc-100"
            />
          </label>
        </div>
      ))}

      {!disabled ? (
        <button
          type="button"
          onClick={addStep}
          className="self-start rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Add step
        </button>
      ) : null}
    </div>
  );
}
