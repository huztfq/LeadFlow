"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppNav } from "@/components/app-nav";
import { ApolloUsageBadge } from "@/components/apollo-usage-badge";
import { LeadflowBrand } from "@/components/leadflow-brand";

export function AppHeader() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--line)]/80 bg-[color-mix(in_srgb,var(--paper-elevated)_82%,transparent)] px-5 py-3 backdrop-blur-xl sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-5">
          <Link href="/assistant" className="flex shrink-0 items-center gap-2">
            <LeadflowBrand size="sm" />
            <span className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-[var(--signal)] sm:inline">
              Studio
            </span>
          </Link>
          <AppNav />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ApolloUsageBadge />
          <button type="button" onClick={handleSignOut} disabled={signingOut} className="lf-btn lf-btn-ghost">
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
