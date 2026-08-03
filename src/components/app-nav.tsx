"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export const NAV_LINKS = [
  { href: "/assistant", label: "Studio" },
  { href: "/search", label: "Search" },
  { href: "/contacts", label: "Contacts" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/inbox", label: "Inbox" },
  { href: "/calendar", label: "Calendar" },
  { href: "/settings/domain", label: "Domain" },
  { href: "/settings/team", label: "Team" },
  { href: "/oversight", label: "Oversight", ownerOnly: true },
] as const;

function sectionTitle(pathname: string): string {
  if (pathname.startsWith("/settings/profile")) return "Profile";
  if (pathname === "/settings") return "Settings";
  const match = NAV_LINKS.find((link) => pathname.startsWith(link.href));
  if (match) {
    return pathname.startsWith("/campaigns/") && pathname !== "/campaigns" ? "Campaign" : match.label;
  }
  if (pathname.startsWith("/unsubscribed")) return "Unsubscribed";
  if (pathname.startsWith("/login")) return "Sign in";
  return "Leadflow";
}

/** Mirrors the owner check used by `ApolloUsageBadge`/`MyCreditsChip` — a
 * light client-side fetch, since role isn't available synchronously here.
 * The real gate is server-side (`requireOwner` on every `/api/oversight/*`
 * route); this just keeps the link out of a member's sidebar. */
function useIsOwner(): boolean {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/team/me");
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data.user?.role === "owner") setIsOwner(true);
      } catch {
        // Non-critical UI — silently ignore.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return isOwner;
}

export function AppNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isOwner = useIsOwner();
  const links = NAV_LINKS.filter((link) => !("ownerOnly" in link && link.ownerOnly) || isOwner);

  return (
    <nav className="lf-nav">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={active ? "lf-nav-link lf-nav-link--active" : "lf-nav-link"}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PageTitleSync() {
  const pathname = usePathname();

  useEffect(() => {
    const section = sectionTitle(pathname);
    document.title = section === "Leadflow" ? "Leadflow · Inferaform" : `Leadflow · ${section}`;
  }, [pathname]);

  return null;
}
