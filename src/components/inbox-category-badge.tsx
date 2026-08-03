import { categoryLabel, type InboxCategoryValue } from "@/lib/inbox-category";

export function categoryBadgeClass(category: InboxCategoryValue): string {
  switch (category) {
    case "interested":
      return "bg-[var(--signal-soft)] text-[var(--signal-deep)]";
    case "booked":
      return "bg-blue-50 text-blue-800";
    case "not_interested":
      return "bg-red-50 text-[var(--danger)]";
    case "unsubscribe":
      return "bg-red-100 text-[var(--danger)]";
    case "question":
      return "bg-amber-50 text-amber-900";
    case "ooo":
      return "bg-[var(--paper)] text-[var(--ink-soft)]";
    case "other":
    default:
      return "bg-[var(--paper)] text-[var(--muted)]";
  }
}

export function InboxCategoryBadge({ category }: { category: InboxCategoryValue }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${categoryBadgeClass(category)}`}>
      {categoryLabel(category)}
    </span>
  );
}
