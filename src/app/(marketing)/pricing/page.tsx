import type { Metadata } from "next";
import Link from "next/link";
import { WaitlistButton } from "@/components/waitlist-modal";
import { CheckIcon } from "@/components/studio-icons";

export const metadata: Metadata = {
  title: "Pricing · Leadflow",
  description:
    "Leadflow pricing — free during the private beta, with Starter, Growth, and Team plans planned for general availability.",
};

type Plan = {
  name: string;
  desc: string;
  price: string;
  period?: string;
  note?: string;
  features: string[];
  cta: { label: string; href?: string; waitlist?: boolean };
  featured?: boolean;
  badge?: string;
};

const PLANS: Plan[] = [
  {
    name: "Private beta",
    desc: "For teams onboarded from the waitlist today.",
    price: "Free",
    note: "No charge while Leadflow is in beta",
    features: [
      "Full access to Studio, Campaigns, Inbox & Calendar",
      "Shared Apollo credit pool",
      "1 workspace, invite-only teammates",
      "Direct line to the team building it",
    ],
    cta: { label: "Join the waitlist", waitlist: true },
  },
  {
    name: "Starter",
    desc: "For a single operator running steady outreach.",
    price: "$49",
    period: "/mo",
    features: [
      "1 seat",
      "~250 Apollo enrichments / mo",
      "Unlimited sequences & sends via Resend",
      "Inbox triage with AI categorization",
      "Calendar (Google, iCal, or booking link)",
    ],
    cta: { label: "Join the waitlist", waitlist: true },
  },
  {
    name: "Growth",
    desc: "For a small team sharing pipeline and credits.",
    price: "$149",
    period: "/mo",
    badge: "Most planned",
    featured: true,
    features: [
      "Up to 3 seats",
      "~1,000 Apollo enrichments / mo",
      "Per-teammate Apollo & AI credit limits",
      "Oversight activity feed across the team",
      "Everything in Starter",
    ],
    cta: { label: "Join the waitlist", waitlist: true },
  },
  {
    name: "Team",
    desc: "For agencies and larger teams with custom needs.",
    price: "Custom",
    features: [
      "Unlimited seats",
      "Custom Apollo credit pool",
      "Dedicated onboarding",
      "Priority support",
      "Everything in Growth",
    ],
    cta: { label: "Talk to sales", href: "/contact" },
  },
];

const FAQ = [
  {
    q: "Is Leadflow actually free right now?",
    a: "Yes. Leadflow is in private beta, and every team we onboard from the waitlist gets full product access at no charge. The plans above show what pricing is expected to look like once we move to general availability.",
  },
  {
    q: "Will I be warned before I'm ever charged?",
    a: "Yes. If and when beta pricing takes effect, we'll reach out with plenty of notice before any card is charged — nothing changes automatically underneath you.",
  },
  {
    q: "What counts as an Apollo enrichment?",
    a: "One credit per contact you actually import with verified contact details — not per search result. Searching Apollo from Studio or the Search page is free; credits are only spent when you import.",
  },
  {
    q: "How do seats and credit limits work?",
    a: "Each workspace has an owner who invites teammates and sets their Apollo and AI credit limits individually (a blank limit means unlimited). It's designed for small, high-trust teams rather than self-serve seat management today.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes — plans are designed to grow with you. During the beta, just tell us what you need via the waitlist form or the contact page and we'll adjust your workspace's limits directly.",
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="lf-mkt-page-hero">
        <div className="lf-mkt-page-hero-inner">
          <span className="lf-mkt-eyebrow">Pricing</span>
          <h1 className="lf-mkt-h2">Simple plans, honest about where we are.</h1>
          <p className="lf-mkt-lede lf-mkt-lede--center">
            Leadflow is in private beta. Everyone we onboard today gets full access for free —
            here&rsquo;s what plans are expected to look like once outreach with us opens up more
            broadly.
          </p>
        </div>
      </section>

      <section className="lf-mkt-section lf-mkt-section--tight">
        <div className="lf-mkt-section-inner">
          <div className="lf-mkt-pricing-grid">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={plan.featured ? "lf-mkt-pricing-card lf-mkt-pricing-card--featured" : "lf-mkt-pricing-card"}
              >
                {plan.badge ? <span className="lf-mkt-pricing-badge">{plan.badge}</span> : null}
                <p className="lf-mkt-pricing-name">{plan.name}</p>
                <p className="lf-mkt-pricing-desc">{plan.desc}</p>
                <div className="lf-mkt-pricing-price">
                  <span className="lf-mkt-pricing-price-amount">{plan.price}</span>
                  {plan.period ? <span className="lf-mkt-pricing-price-period">{plan.period}</span> : null}
                </div>
                {plan.note ? <p className="lf-mkt-pricing-note">{plan.note}</p> : null}

                <div className="lf-mkt-pricing-features">
                  {plan.features.map((feature) => (
                    <div key={feature} className="lf-mkt-pricing-feature">
                      <CheckIcon width={15} height={15} className="lf-mkt-pricing-feature-icon" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                {plan.cta.waitlist ? (
                  <WaitlistButton className={plan.featured ? "lf-btn lf-btn-primary" : "lf-btn lf-btn-ghost"}>
                    {plan.cta.label}
                  </WaitlistButton>
                ) : (
                  <Link href={plan.cta.href ?? "/contact"} className="lf-btn lf-btn-ghost">
                    {plan.cta.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          <p className="lf-mkt-pricing-beta-note">
            All prices are in USD and reflect our current best plan for general availability — they
            may change before beta ends, and we&rsquo;ll always give advance notice. Apollo
            enrichment volumes are estimates, not contractual limits.
          </p>
        </div>
      </section>

      <section className="lf-mkt-section lf-mkt-section--tight lf-mkt-section--divider-top">
        <div className="lf-mkt-section-inner lf-mkt-section-inner--narrow">
          <div className="lf-mkt-section-head">
            <span className="lf-mkt-eyebrow">FAQ</span>
            <h2 className="lf-mkt-h2">Pricing questions</h2>
          </div>

          <div className="lf-mkt-faq-list">
            {FAQ.map((item) => (
              <div key={item.q} className="lf-mkt-faq-item">
                <p className="lf-mkt-faq-q">{item.q}</p>
                <p className="lf-mkt-faq-a">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lf-mkt-cta-band">
        <div className="lf-mkt-section lf-mkt-section-inner">
          <span className="lf-mkt-eyebrow lf-mkt-eyebrow--light">Still deciding?</span>
          <h2 className="lf-mkt-h2">Join the waitlist, or just ask us.</h2>
          <p className="lf-mkt-lede">
            We&rsquo;re happy to talk through which plan fits before you commit to anything.
          </p>
          <div className="lf-mkt-cta-actions">
            <WaitlistButton className="lf-btn lf-btn-primary">Join the waitlist</WaitlistButton>
            <Link href="/contact" className="lf-btn lf-mkt-btn-ghost-light">
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
