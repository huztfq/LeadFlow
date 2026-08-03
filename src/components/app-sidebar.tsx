"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AccountMenu } from "@/components/account-menu";
import { AppNav } from "@/components/app-nav";
import { ApolloUsageBadge } from "@/components/apollo-usage-badge";
import { ChatHistoryList } from "@/components/chat-history-list";
import { INFERFORM_BYLINE, LeadflowBrand } from "@/components/leadflow-brand";
import { MyCreditsChip } from "@/components/my-credits-chip";
import { PlusIcon } from "@/components/studio-icons";

export function AppSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Close the drawer whenever the route changes (e.g. after tapping a nav link).
  // Adjusted during render rather than in an effect, per React's guidance for
  // resetting state in response to a prop/value change.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  // Lock page scroll behind the drawer while it's open on mobile/tablet.
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <>
      <header className="lf-mobile-topbar">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="lf-icon-btn"
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
        >
          <span className="lf-hamburger" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
        <Link href="/assistant" className="min-w-0">
          <LeadflowBrand size="sm" />
        </Link>
        <ApolloUsageBadge />
      </header>

      {mobileOpen ? (
        <div
          className="lf-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside className={`lf-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <div className="lf-sidebar-head">
          <Link href="/assistant" className="lf-sidebar-brand">
            <LeadflowBrand />
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lf-icon-btn shrink-0 lg:hidden"
            aria-label="Close navigation menu"
          >
            ✕
          </button>
        </div>

        <AppNav onNavigate={() => setMobileOpen(false)} />

        <Link
          href="/assistant"
          onClick={() => setMobileOpen(false)}
          className="lf-new-chat-btn"
        >
          <PlusIcon width={14} height={14} />
          New chat
        </Link>

        <Suspense fallback={null}>
          <ChatHistoryList onNavigate={() => setMobileOpen(false)} />
        </Suspense>

        <div className="lf-sidebar-footer">
          <div className="flex flex-wrap items-center gap-2">
            <ApolloUsageBadge />
            <MyCreditsChip />
          </div>
          <AccountMenu onNavigate={() => setMobileOpen(false)} />
          <p className="lf-sidebar-byline">{INFERFORM_BYLINE}</p>
        </div>
      </aside>
    </>
  );
}
