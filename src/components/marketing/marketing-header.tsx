"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LeadflowBrand } from "@/components/leadflow-brand";
import { WaitlistButton } from "@/components/waitlist-modal";

const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export function MarketingHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="lf-mkt-header">
      <div className="lf-mkt-header-inner">
        <Link href="/" aria-label="Leadflow home" onClick={() => setOpen(false)}>
          <LeadflowBrand size="sm" tone="light" />
        </Link>

        <nav className="lf-mkt-nav" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "lf-mkt-nav-link lf-mkt-nav-link--active" : "lf-mkt-nav-link"}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="lf-mkt-header-actions">
          <Link href="/login" className="lf-mkt-btn-login">
            Log in
          </Link>
          <WaitlistButton className="lf-btn lf-btn-primary lf-mkt-btn-waitlist">Join waitlist</WaitlistButton>
        </div>

        <button
          type="button"
          className="lf-mkt-menu-btn"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="lf-hamburger" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      {open ? (
        <div className="lf-mkt-mobile-panel">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="lf-mkt-mobile-link" onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <div className="lf-mkt-mobile-actions">
            <Link href="/login" className="lf-btn lf-mkt-btn-ghost-light w-full" onClick={() => setOpen(false)}>
              Log in
            </Link>
            <WaitlistButton className="lf-btn lf-btn-primary w-full">Join waitlist</WaitlistButton>
          </div>
        </div>
      ) : null}
    </header>
  );
}
