"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const NAV_LINKS = [
  { href: "/search", label: "Search" },
  { href: "/leads", label: "Leads" },
  { href: "/campaigns", label: "Campaigns" },
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

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-4">
      {NAV_LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "text-sm font-medium text-zinc-900"
                : "text-sm text-zinc-600 hover:text-zinc-900"
            }
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
    document.title = section === "Leadflow" ? "Leadflow" : `Leadflow · ${section}`;
  }, [pathname]);

  return null;
}
