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
  completed: "border-green-200 bg-green-50 text-green-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  unsubscribed: "border-zinc-300 bg-zinc-100 text-zinc-600",
  bounced: "border-amber-200 bg-amber-50 text-amber-700",
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
    return <p className="text-sm text-zinc-500">No leads enrolled yet.</p>;
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

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-3 py-2">Lead</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Step</th>
              <th className="px-3 py-2">Attempts</th>
              <th className="px-3 py-2">Next send</th>
              <th className="px-3 py-2">Last error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-zinc-900">
            {enrollments.map((enrollment) => (
              <tr key={enrollment.id}>
                <td className="px-3 py-2">{enrollment.leadName || enrollment.leadEmail || "—"}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[enrollment.status]}`}
                  >
                    {enrollment.status}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{stepLabel(enrollment, totalSteps)}</td>
                <td className="px-3 py-2">{enrollment.attemptCount}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {enrollment.status === "active" ? new Date(enrollment.nextSendAt).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2 text-zinc-500">{enrollment.lastError ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
