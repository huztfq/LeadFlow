"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ExecuteResult } from "@/lib/assistant-execute";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function NodeShell({
  icon,
  kind,
  title,
  isSelected,
  children,
  showTarget = true,
  showSource = true,
}: {
  icon: string;
  kind: string;
  title: string;
  isSelected?: boolean;
  children?: React.ReactNode;
  showTarget?: boolean;
  showSource?: boolean;
}) {
  return (
    <div className={`lf-node ${isSelected ? "is-selected" : ""}`}>
      {showTarget ? <Handle type="target" position={Position.Top} /> : null}
      <div className="lf-node-head">
        <span className="lf-node-icon">{icon}</span>
        <div className="min-w-0">
          <div className="lf-node-kind">{kind}</div>
          <div className="lf-node-title truncate">{title}</div>
        </div>
      </div>
      {children ? <div className="lf-node-body">{children}</div> : null}
      {showSource ? <Handle type="source" position={Position.Bottom} /> : null}
    </div>
  );
}

export type SearchNodeData = {
  qKeywords?: string;
  industry?: string;
  titles: string[];
  locations: string[];
  targetCount: number;
  isSelected: boolean;
};

export function SearchNode({ data }: NodeProps & { data: SearchNodeData }) {
  return (
    <NodeShell icon="Q" kind="Search" title="Apollo lead search" isSelected={data.isSelected} showTarget={false}>
      {data.titles.length ? <div>Titles: {data.titles.join(", ")}</div> : null}
      {data.locations.length ? <div>Locations: {data.locations.join(", ")}</div> : null}
      {data.industry ? <div>Industry: {data.industry}</div> : null}
      {data.qKeywords ? <div>Keywords: {data.qKeywords}</div> : null}
      <div>Target: {data.targetCount} people</div>
    </NodeShell>
  );
}

export type EnrichNodeData = {
  targetCount: number;
  isSelected: boolean;
};

export function EnrichNode({ data }: NodeProps & { data: EnrichNodeData }) {
  return (
    <NodeShell icon="E" kind="Enrich" title="Enrich & import" isSelected={data.isSelected}>
      <div>Reveal emails via Apollo</div>
      <div>Save up to {data.targetCount} contacts</div>
    </NodeShell>
  );
}

export type CampaignNodeData = {
  name: string;
  stepCount: number;
  isSelected: boolean;
};

export function CampaignNode({ data }: NodeProps & { data: CampaignNodeData }) {
  return (
    <NodeShell icon="C" kind="Campaign" title={data.name || "Untitled campaign"} isSelected={data.isSelected}>
      <div>
        {data.stepCount} email{data.stepCount === 1 ? "" : "s"} in sequence
      </div>
    </NodeShell>
  );
}

export type StepNodeData = {
  index: number;
  subject: string;
  delayDays: number;
  bodyHtml: string;
  isSelected: boolean;
};

export function StepNode({ data }: NodeProps & { data: StepNodeData }) {
  return (
    <NodeShell
      icon={`${data.index + 1}`}
      kind={data.delayDays === 0 ? "Send immediately" : `Day ${data.delayDays}`}
      title={data.subject || "Untitled email"}
      isSelected={data.isSelected}
    >
      <div className="line-clamp-2">{stripHtml(data.bodyHtml) || "No body yet"}</div>
    </NodeShell>
  );
}

export type AddStepNodeData = {
  onAdd: () => void;
};

export function AddStepNode({ data }: NodeProps & { data: AddStepNodeData }) {
  return (
    <div>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <button type="button" className="lf-node-add" onClick={data.onAdd}>
        + Add email step
      </button>
    </div>
  );
}

export type EnrollNodeData = {
  status: "idle" | "running" | "done" | "error";
  targetCount: number;
  result: ExecuteResult | null;
  isSelected: boolean;
};

export function EnrollNode({ data }: NodeProps & { data: EnrollNodeData }) {
  const label =
    data.status === "done"
      ? "Started"
      : data.status === "running"
        ? "Starting…"
        : data.status === "error"
          ? "Failed"
          : "Idle";
  return (
    <NodeShell icon="R" kind="Enroll & run" title="Start campaign" isSelected={data.isSelected} showSource={false}>
      <div className="flex items-center gap-1.5">
        <span className={`lf-status-dot is-${data.status === "idle" ? "" : data.status}`} />
        {label}
      </div>
      {data.result ? (
        <div>
          Enrolled {data.result.enrolled} of {data.targetCount}
        </div>
      ) : (
        <div>Will enroll up to {data.targetCount} contacts</div>
      )}
    </NodeShell>
  );
}

export const assistantNodeTypes = {
  search: SearchNode,
  enrich: EnrichNode,
  campaign: CampaignNode,
  step: StepNode,
  addStep: AddStepNode,
  enroll: EnrollNode,
};
