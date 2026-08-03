"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const NAV_LINKS = [
  { href: "/assistant", label: "Studio" },
  { href: "/search", label: "Search" },
  { href: "/contacts", label: "Contacts" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/inbox", label: "Inbox" },
  { href: "/calendar", label: "Calendar" },
  { href: "/settings/domain", label: "Domain" },
  { href: "/settings/team", label: "Team" },
] as const;

function sectionTitle(pathname: string): string {
  const match = NAV_LINKS.find((link) => pathname.startsWith(link.href));
  if (match) {
    return pathname.startsWith("/campaigns/") && pathname !== "/campaigns" ? "Campaign" : match.label;
  }
  if (pathname.startsWith("/unsubscribed")) return "Unsubscribed";
  if (pathname.startsWith("/login")) return "Sign in";
  return "Leadflow";
}

export function AppNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="lf-nav">
      {NAV_LINKS.map((link) => {
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
