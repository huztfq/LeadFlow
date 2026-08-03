"use client";

export type EnrollmentStatus = "active" | "completed" | "unsubscribed" | "bounced" | "failed";

export type EnrollmentRow = {
  id: string;
  leadId: string;
  leadEmail: string | null;
  leadName: string | null;
  status: EnrollmentStatus;
  currentStep: number;
  attemptCount: number;
  nextSendAt: string;
  lastError: string | null;
  lastSentAt: string | null;
};

type EnrollmentTableProps = {
  enrollments: EnrollmentRow[];
  totalSteps: number;
};

const STATUS_ORDER: EnrollmentStatus[] = ["active", "completed", "failed", "unsubscribed", "bounced"];

const STATUS_STYLES: Record<EnrollmentStatus, string> = {
  active: "border-blue-200 bg-blue-50 text-blue-700",
  completed: "border-[color-mix(in_srgb,var(--signal)_35%,var(--line))] bg-[var(--signal-soft)] text-[var(--signal-deep)]",
  failed: "border-red-200 bg-red-50 text-[var(--danger)]",
  unsubscribed: "border-[var(--line)] bg-[var(--paper)] text-[var(--muted)]",
  bounced: "border-amber-200 bg-amber-50 text-[var(--warn)]",
};

function countByStatus(enrollments: EnrollmentRow[]): Record<EnrollmentStatus, number> {
  const counts: Record<EnrollmentStatus, number> = {
    active: 0,
    completed: 0,
    unsubscribed: 0,
    bounced: 0,
    failed: 0,
  };
  for (const enrollment of enrollments) {
    counts[enrollment.status] += 1;
  }
  return counts;
}

function stepLabel(enrollment: EnrollmentRow, totalSteps: number): string {
  if (enrollment.status === "completed") return "Done";
  if (totalSteps === 0) return "—";
  return `${Math.min(enrollment.currentStep + 1, totalSteps)} of ${totalSteps}`;
}

export function EnrollmentTable({ enrollments, totalSteps }: EnrollmentTableProps) {
  const counts = countByStatus(enrollments);

  if (enrollments.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No leads enrolled yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_ORDER.map((status) => (
          <span
            key={status}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
          >
            {status}: {counts[status]}
          </span>
        ))}
      </div>

      <div className="lf-table-wrap">
        <table className="lf-table">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Status</th>
              <th>Step</th>
              <th>Attempts</th>
              <th>Next send</th>
              <th>Last error</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((enrollment) => (
              <tr key={enrollment.id}>
                <td>{enrollment.leadName || enrollment.leadEmail || "—"}</td>
                <td>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[enrollment.status]}`}
                  >
                    {enrollment.status}
                  </span>
                </td>
                <td className="whitespace-nowrap">{stepLabel(enrollment, totalSteps)}</td>
                <td>{enrollment.attemptCount}</td>
                <td className="whitespace-nowrap">
                  {enrollment.status === "active"
                    ? new Date(enrollment.nextSendAt).toLocaleString()
                    : "—"}
                </td>
                <td className="text-[var(--muted)]">{enrollment.lastError ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
