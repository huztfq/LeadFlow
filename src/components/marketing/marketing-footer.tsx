import Link from "next/link";
import { INFERFORM_BYLINE, LeadflowBrand } from "@/components/leadflow-brand";

const FOOTER_COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/login", label: "Log in" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
    ],
  },
] as const;

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="lf-mkt-footer">
      <div className="lf-mkt-footer-inner">
        <div className="lf-mkt-footer-brand-col">
          <Link href="/" aria-label="Leadflow home">
            <LeadflowBrand size="md" tone="light" />
          </Link>
          <p className="lf-mkt-footer-tagline">
            Design outreach with us. Chat a brief, approve a sequence, and let Leadflow enrich
            Apollo leads, send via Resend, and surface replies worth acting on.
          </p>
          <p className="lf-mkt-footer-tagline">{INFERFORM_BYLINE}</p>
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <div key={column.heading}>
            <p className="lf-mkt-footer-heading">{column.heading}</p>
            <nav className="lf-mkt-footer-links">
              {column.links.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        ))}
      </div>

      <div className="lf-mkt-footer-bottom">
        <span>© {year} Inferaform. All rights reserved.</span>
        <span>Leadflow is currently in private beta.</span>
      </div>
    </footer>
  );
}
