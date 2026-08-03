"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type UserSummary = {
  role: "owner" | "member";
  apolloCreditLimit: number | null;
  apolloCreditsUsed: number;
  aiCreditLimit: number | null;
  aiCreditsUsed: number;
};

function formatLimit(used: number, limit: number | null): string {
  return limit === null ? `${used}` : `${used}/${limit}`;
}

/**
 * Compact link to `/settings/team` showing this user's own app-tracked
 * Apollo/AI credit usage — distinct from `ApolloUsageBadge`, which shows the
 * shared Apollo *account's* real remaining credits. Hidden for the
 * APP_PASSWORD-authenticated account (`role: "owner"`): that account has no
 * app-tracked AI credit pool, and `ApolloUsageBadge` already covers its
 * (unlimited) Apollo usage.
 */
export function MyCreditsChip() {
  const [user, setUser] = useState<UserSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/team/me");
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setUser(data.user as UserSummary);
      } catch {
        // Non-critical UI — silently ignore.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user || user.role === "owner") return null;

  return (
    <Link href="/settings/team" className="lf-chip" title="Your Apollo and AI credit usage">
      Apollo {formatLimit(user.apolloCreditsUsed, user.apolloCreditLimit)} · AI{" "}
      {formatLimit(user.aiCreditsUsed, user.aiCreditLimit)}
    </Link>
  );
}
