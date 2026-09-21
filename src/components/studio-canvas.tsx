"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnNodeDrag,
  type OnNodesChange,
} from "@xyflow/react";
import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  assistantNodeTypes,
  type AddStepNodeData,
  type CampaignNodeData,
  type EnrichNodeData,
  type EnrollNodeData,
  type SearchNodeData,
  type StepNodeData,
} from "@/components/assistant-canvas-nodes";
import { PlanDocument } from "@/components/plan-document";
import { CloseIcon, TrashIcon } from "@/components/studio-icons";
import type { ExecuteResult } from "@/lib/assistant-execute";
import { emptyOutreachStep, type OutreachPlan } from "@/lib/assistant-plan";

export type EnrollStatus = "idle" | "running" | "done" | "error";

type PlanUpdater = (updater: (plan: OutreachPlan) => OutreachPlan) => void;

type StudioCanvasProps = {
  plan: OutreachPlan;
  planVersion: number;
  onPlanChange: PlanUpdater;
  enrollStatus: EnrollStatus;
  executeResult: ExecuteResult | null;
  onRunEnroll: () => void;
};

type PositionEntry = { id: string; x: number; y: number };

// Main pipeline flows top-to-bottom, one node per row, all sharing BASE_X so the stack
// reads as a single centered column (fitView is scoped to just these nodes — see
// `mainFlowNodeRefs` below — so the branch node's offset never skews the centering).
// ROW_GAP is generous because node heights vary (search/enroll have several body lines).
const ROW_GAP = 230;
const BRANCH_GAP = 200;
const BASE_X = 24;
const START_Y = 24;

function stepId(index: number) {
  return `step-${index}`;
}

function layoutPositions(plan: OutreachPlan): PositionEntry[] {
  const stepCount = plan.campaign.steps.length;
  const positions: PositionEntry[] = [
    { id: "search", x: BASE_X, y: START_Y },
    { id: "enrich", x: BASE_X, y: START_Y + ROW_GAP },
    { id: "campaign", x: BASE_X, y: START_Y + ROW_GAP * 2 },
  ];
  for (let i = 0; i < stepCount; i += 1) {
    positions.push({ id: stepId(i), x: BASE_X, y: START_Y + ROW_GAP * (3 + i) });
  }
  positions.push({ id: "enroll", x: BASE_X, y: START_Y + ROW_GAP * (3 + stepCount) });
  positions.push({
    id: "addStep",
    x: BASE_X + BRANCH_GAP,
    y: START_Y + ROW_GAP * Math.max(2 + stepCount, 3),
  });
  return positions;
}

function buildEdges(plan: OutreachPlan): Edge[] {
  const stepCount = plan.campaign.steps.length;
  const edges: Edge[] = [
    { id: "e-search-enrich", source: "search", target: "enrich" },
    { id: "e-enrich-campaign", source: "enrich", target: "campaign" },
  ];

  if (stepCount > 0) {
    edges.push({ id: "e-campaign-step0", source: "campaign", target: stepId(0) });
    for (let i = 0; i < stepCount - 1; i += 1) {
      edges.push({ id: `e-${stepId(i)}-${stepId(i + 1)}`, source: stepId(i), target: stepId(i + 1) });
    }
    const lastStep = stepId(stepCount - 1);
    edges.push({ id: "e-last-enroll", source: lastStep, target: "enroll" });
    edges.push({
      id: "e-last-add",
      source: lastStep,
      target: "addStep",
      type: "straight",
      className: "lf-edge-ghost",
    });
  } else {
    edges.push({ id: "e-campaign-enroll", source: "campaign", target: "enroll" });
  }

  return edges.map((edge) => ({
    ...edge,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#0f766e", width: 16, height: 16 },
  }));
}

type AnyNodeData =
  | SearchNodeData
  | EnrichNodeData
  | CampaignNodeData
  | EnrollNodeData
  | AddStepNodeData
  | StepNodeData;

function nodeType(id: string): "search" | "enrich" | "campaign" | "enroll" | "addStep" | "step" {
  if (id === "search" || id === "enrich" || id === "campaign" || id === "enroll" || id === "addStep") return id;
  return "step";
}

function buildNodeData(
  id: string,
  plan: OutreachPlan,
  selectedId: string | null,
  enrollStatus: EnrollStatus,
  executeResult: ExecuteResult | null,
  onAddStep: () => void,
): AnyNodeData {
  const isSelected = id === selectedId;
  const targetCount = plan.search.targetCount ?? 10;

  switch (nodeType(id)) {
    case "search":
      return {
        qKeywords: plan.search.q_keywords,
        industry: plan.search.industry,
        titles: plan.search.person_titles ?? [],
        locations: plan.search.person_locations ?? [],
        targetCount,
        isSelected,
      } satisfies SearchNodeData;
    case "enrich":
      return { targetCount, isSelected } satisfies EnrichNodeData;
    case "campaign":
      return {
        name: plan.campaign.name,
        stepCount: plan.campaign.steps.length,
        isSelected,
      } satisfies CampaignNodeData;
    case "enroll":
      return {
        status: enrollStatus,
        targetCount,
        result: executeResult,
        isSelected: false,
      } satisfies EnrollNodeData;
    case "addStep":
      return { onAdd: onAddStep } satisfies AddStepNodeData;
    case "step": {
      const index = Number(id.slice(5));
      const step = plan.campaign.steps[index];
      return {
        index,
        subject: step?.subject ?? "",
        delayDays: step?.delayDays ?? 0,
        bodyHtml: step?.bodyHtml ?? "",
        isSelected,
      } satisfies StepNodeData;
    }
  }
}

function buildNode(
  id: string,
  position: { x: number; y: number },
  plan: OutreachPlan,
  selectedId: string | null,
  enrollStatus: EnrollStatus,
  executeResult: ExecuteResult | null,
  onAddStep: () => void,
): Node {
  const type = nodeType(id);
  const data = buildNodeData(id, plan, selectedId, enrollStatus, executeResult, onAddStep);
  if (type === "enroll") return { id, type, position, data, draggable: true };
  if (type === "addStep") return { id, type, position, data, draggable: false, selectable: false };
  return { id, type, position, data };
}

function buildNodesForPlan(
  plan: OutreachPlan,
  selectedId: string | null,
  enrollStatus: EnrollStatus,
  executeResult: ExecuteResult | null,
  onAddStep: () => void,
): Node[] {
  return layoutPositions(plan).map((p) =>
    buildNode(p.id, { x: p.x, y: p.y }, plan, selectedId, enrollStatus, executeResult, onAddStep),
  );
}

/** Catches render errors in the canvas so the artifact panel is never left blank. */
class CanvasErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Studio canvas failed to render; falling back to plan document.", error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/**
 * Renders the plan as an editable node canvas, falling back to a plain editable document
 * (filters + steps list) if the canvas throws — so the right panel is never blank while
 * Approve & start is showing.
 */
export function PlanArtifact(props: StudioCanvasProps) {
  return (
    <CanvasErrorBoundary
      fallback={<PlanDocument plan={props.plan} onPlanChange={props.onPlanChange} />}
    >
      <StudioCanvas {...props} />
    </CanvasErrorBoundary>
  );
}

function StudioCanvas({
  plan,
  planVersion,
  onPlanChange,
  enrollStatus,
  executeResult,
  onRunEnroll,
}: StudioCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stepCount = plan.campaign.steps.length;
  const structureSignature = `${planVersion}:${stepCount}`;
  const [layoutSignature, setLayoutSignature] = useState(structureSignature);

  const addStep = useCallback(() => {
    onPlanChange((current) => ({
      ...current,
      campaign: { ...current.campaign, steps: [...current.campaign.steps, emptyOutreachStep()] },
    }));
  }, [onPlanChange]);

  // `nodes` is the source of truth for `position`/`measured`, updated only via `applyNodeChanges`
  // (through `onNodesChange`) and on structural relayout. Nodes render with `visibility: hidden`
  // until ReactFlow measures their real DOM size and reports it back via `onNodesChange`; that
  // measurement (`node.measured`) MUST be preserved on every subsequent render or ReactFlow thinks
  // the nodes were never measured and they stay hidden forever — so we never rebuild this array
  // from scratch except on a genuine structural change (new plan / step count change).
  const [nodes, setNodes] = useState<Node[]>(() =>
    buildNodesForPlan(plan, null, enrollStatus, executeResult, addStep),
  );

  // Relayout only when a fresh plan arrives or the step count changes — not on every field edit —
  // so dragged positions and measured dimensions survive text edits but reset for structural
  // changes. This adjusts state during render (React's supported pattern for resetting state when
  // a computed value changes) rather than in an effect, so it takes effect before paint.
  if (layoutSignature !== structureSignature) {
    setLayoutSignature(structureSignature);
    setSelectedId(null);
    setNodes(buildNodesForPlan(plan, null, enrollStatus, executeResult, addStep));
  }

  // Non-structural changes (field edits, selection, enroll status) only need to refresh node
  // `data` — computed here as a derived value instead of stored state, so `position`/`measured`
  // on the underlying `nodes` state are never touched and ReactFlow never re-hides a node.
  const renderedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: buildNodeData(node.id, plan, selectedId, enrollStatus, executeResult, addStep),
      })),
    [nodes, plan, selectedId, enrollStatus, executeResult, addStep],
  );

  const edges = useMemo(() => buildEdges(plan), [plan]);

  // Scope fitView to the main pipeline column (excluding the "add step" branch node) so the
  // vertical stack is always centered in the pane — the branch node's sideways offset would
  // otherwise skew the bounding box and pull the centered column off to one side.
  const mainFlowNodeRefs = useMemo(() => {
    const ids = ["search", "enrich", "campaign"];
    for (let i = 0; i < stepCount; i += 1) ids.push(stepId(i));
    ids.push("enroll");
    return ids.map((id) => ({ id }));
  }, [stepCount]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (!node.id.startsWith("step-")) return;
      const stepEntries = nodes.filter((n) => n.id.startsWith("step-"));
      const ordered = [...stepEntries].sort((a, b) => a.position.y - b.position.y);
      const newOrder = ordered.map((n) => Number(n.id.slice(5)));
      const changed = newOrder.some((idx, i) => idx !== i);
      if (changed) {
        onPlanChange((current) => ({
          ...current,
          campaign: {
            ...current.campaign,
            steps: newOrder.map((idx) => current.campaign.steps[idx]),
          },
        }));
      }
      const freshPositions = layoutPositions(plan);
      setNodes((current) =>
        current.map((n) => {
          const pos = freshPositions.find((p) => p.id === n.id);
          return pos ? { ...n, position: { x: pos.x, y: pos.y } } : n;
        }),
      );
    },
    [nodes, plan, onPlanChange],
  );

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (node.id === "addStep") return;
    setSelectedId((current) => (current === node.id ? null : node.id));
  }, []);

  const handlePaneClick = useCallback(() => setSelectedId(null), []);
  const closeDetail = useCallback(() => setSelectedId(null), []);

  // Escape closes whichever node's detail popup is open, matching the backdrop-click affordance.
  useEffect(() => {
    if (!selectedId) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="lf-flow-shell flex-1">
        <ReactFlow
          // Remounting on structural change (new plan / step count) re-runs the `fitView` prop
          // below, so the pipeline re-centers itself whenever its shape changes — not just on
          // the very first mount.
          key={structureSignature}
          nodes={renderedNodes}
          edges={edges}
          nodeTypes={assistantNodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          fitView
          fitViewOptions={{ padding: 0.25, maxZoom: 1, nodes: mainFlowNodeRefs }}
          // Low enough that fitView can always shrink the whole pipeline to fit — and stay
          // centered — inside a half-width pane, however many email steps the plan has.
          minZoom={0.08}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={22} size={1} color="var(--line)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {selectedId ? (
        <NodeDetailModal
          selectedId={selectedId}
          plan={plan}
          onPlanChange={onPlanChange}
          onClose={closeDetail}
          enrollStatus={enrollStatus}
          executeResult={executeResult}
          onRunEnroll={onRunEnroll}
        />
      ) : null}
    </div>
  );
}

/** Shared chrome for every node detail popup: backdrop, header with close, scrollable body, optional footer. */
function ModalShell({
  eyebrow,
  title,
  onClose,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      className="lf-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="lf-modal lf-rise" role="dialog" aria-modal="true" aria-label={title}>
        <div className="lf-modal-header">
          <div className="min-w-0">
            <p className="lf-modal-eyebrow">{eyebrow}</p>
            <p className="lf-modal-title truncate" title={title}>
              {title}
            </p>
          </div>
          <button
            type="button"
            className="lf-artifact-icon-btn shrink-0"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="lf-modal-body">{children}</div>
        {footer ? <div className="lf-modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

function StructuralNote({ children }: { children: ReactNode }) {
  return <p className="lf-modal-note">{children}</p>;
}

/**
 * Node detail popup, opened by clicking any canvas node. Search/enrich/campaign are core pipeline
 * stages — shown with full details but no delete (removing them would break the plan structure).
 * Email steps are freely deletable (down to a minimum of one). Enroll shows run status/result and
 * doubles as the run trigger, mirroring the artifact header's Approve & start button.
 */
function NodeDetailModal({
  selectedId,
  plan,
  onPlanChange,
  onClose,
  enrollStatus,
  executeResult,
  onRunEnroll,
}: {
  selectedId: string;
  plan: OutreachPlan;
  onPlanChange: PlanUpdater;
  onClose: () => void;
  enrollStatus: EnrollStatus;
  executeResult: ExecuteResult | null;
  onRunEnroll: () => void;
}) {
  if (selectedId === "search") {
    return (
      <ModalShell
        eyebrow="Search"
        title="Apollo lead search"
        onClose={onClose}
        footer={<StructuralNote>Core pipeline step — always included, so it can&apos;t be deleted.</StructuralNote>}
      >
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
      </ModalShell>
    );
  }

  if (selectedId === "enrich") {
    const targetCount = plan.search.targetCount ?? 10;
    return (
      <ModalShell
        eyebrow="Enrich"
        title="Enrich & import"
        onClose={onClose}
        footer={<StructuralNote>Core pipeline step — always included, so it can&apos;t be deleted.</StructuralNote>}
      >
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          Reveals verified work emails via Apollo for every contact the search step finds, then imports
          them into Leadflow as contacts.
        </p>
        <label className="lf-inspector-field">
          Target count (shared with lead search, 1–30)
          <input
            type="number"
            min={1}
            max={30}
            className="lf-input w-28"
            value={targetCount}
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
      </ModalShell>
    );
  }

  if (selectedId === "campaign") {
    return (
      <ModalShell
        eyebrow="Campaign"
        title="Edit campaign"
        onClose={onClose}
        footer={<StructuralNote>Core pipeline step — always included, so it can&apos;t be deleted.</StructuralNote>}
      >
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
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          {plan.campaign.steps.length} email{plan.campaign.steps.length === 1 ? "" : "s"} in the sequence
          below.
        </p>
      </ModalShell>
    );
  }

  if (selectedId === "enroll") {
    const label =
      enrollStatus === "done"
        ? "Started"
        : enrollStatus === "running"
          ? "Starting…"
          : enrollStatus === "error"
            ? "Failed — try again"
            : "Idle";
    const targetCount = plan.search.targetCount ?? 10;
    return (
      <ModalShell
        eyebrow="Enroll & run"
        title="Start campaign"
        onClose={onClose}
        footer={
          <button
            type="button"
            className="lf-btn lf-btn-primary"
            onClick={onRunEnroll}
            disabled={enrollStatus === "running" || enrollStatus === "done"}
          >
            {enrollStatus === "done" ? "Started" : enrollStatus === "running" ? "Starting…" : "Approve & start"}
          </button>
        }
      >
        <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
          <span className={`lf-status-dot is-${enrollStatus === "idle" ? "" : enrollStatus}`} />
          {label}
        </div>
        {executeResult ? (
          <ul className="grid gap-1 text-xs text-[var(--ink-soft)] sm:grid-cols-2">
            <li>Searched: {executeResult.searched}</li>
            <li>Enriched: {executeResult.enriched}</li>
            <li>Imported: {executeResult.imported}</li>
            <li>Updated: {executeResult.updated}</li>
            <li>Enrolled: {executeResult.enrolled}</li>
            <li>Skipped (no email): {executeResult.skippedNoEmail}</li>
          </ul>
        ) : (
          <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
            Enriches and enrolls up to {targetCount} contacts into the campaign above once approved.
          </p>
        )}
      </ModalShell>
    );
  }

  if (selectedId.startsWith("step-")) {
    const index = Number(selectedId.slice(5));
    const step = plan.campaign.steps[index];
    if (!step) return null;
    const stepCount = plan.campaign.steps.length;
    const canDelete = stepCount > 1;

    function updateStep(patch: Partial<typeof step>) {
      onPlanChange((current) => ({
        ...current,
        campaign: {
          ...current.campaign,
          steps: current.campaign.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
        },
      }));
    }

    function moveStep(dir: -1 | 1) {
      onPlanChange((current) => {
        const target = index + dir;
        if (target < 0 || target >= current.campaign.steps.length) return current;
        const steps = [...current.campaign.steps];
        [steps[index], steps[target]] = [steps[target], steps[index]];
        return { ...current, campaign: { ...current.campaign, steps } };
      });
    }

    function removeStep() {
      if (!canDelete) return;
      onPlanChange((current) => {
        if (current.campaign.steps.length <= 1) return current;
        return {
          ...current,
          campaign: { ...current.campaign, steps: current.campaign.steps.filter((_, i) => i !== index) },
        };
      });
      onClose();
    }

    return (
      <ModalShell
        eyebrow={`Email step ${index + 1} of ${stepCount}`}
        title={step.subject || "Untitled email"}
        onClose={onClose}
        footer={
          <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="lf-btn lf-btn-ghost !border-red-200 text-[var(--danger)]"
              onClick={removeStep}
              disabled={!canDelete}
              title={canDelete ? "Delete this email step" : "A campaign needs at least one email step"}
            >
              <TrashIcon width={14} height={14} />
              Delete step
            </button>
            {!canDelete ? (
              <StructuralNote>A campaign needs at least one email step.</StructuralNote>
            ) : null}
          </div>
        }
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="lf-btn lf-btn-ghost !px-2.5 !py-1 text-xs"
            onClick={() => moveStep(-1)}
            disabled={index === 0}
          >
            Move earlier
          </button>
          <button
            type="button"
            className="lf-btn lf-btn-ghost !px-2.5 !py-1 text-xs"
            onClick={() => moveStep(1)}
            disabled={index === stepCount - 1}
          >
            Move later
          </button>
        </div>
        <label className="lf-inspector-field">
          Delay (days after previous step)
          <input
            type="number"
            min={0}
            className="lf-input w-32"
            value={step.delayDays}
            onChange={(event) => updateStep({ delayDays: Number(event.target.value) || 0 })}
          />
        </label>
        <label className="lf-inspector-field">
          Subject
          <input
            className="lf-input"
            value={step.subject}
            onChange={(event) => updateStep({ subject: event.target.value })}
          />
        </label>
        <label className="lf-inspector-field">
          Body (HTML)
          <textarea
            className="lf-input font-mono text-sm"
            rows={6}
            value={step.bodyHtml}
            onChange={(event) => updateStep({ bodyHtml: event.target.value })}
          />
        </label>
      </ModalShell>
    );
  }

  return null;
}
