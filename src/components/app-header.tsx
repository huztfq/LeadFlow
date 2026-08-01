"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/search", label: "Search" },
  { href: "/leads", label: "Leads" },
];

export function AppHeader() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
      <div className="flex items-center gap-6">
        <span className="text-lg font-semibold text-zinc-900">Leadflow</span>
        <nav className="flex items-center gap-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </header>
  );
}
