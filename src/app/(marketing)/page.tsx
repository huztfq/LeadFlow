import type { Metadata } from "next";
import Link from "next/link";
import { WaitlistButton } from "@/components/waitlist-modal";
import {
  CalendarDotIcon,
  ChatIcon,
  MailIcon,
  SearchIcon,
  SendIcon,
  UsersIcon,
} from "@/components/marketing/marketing-icons";
import { CheckIcon } from "@/components/studio-icons";

export const metadata: Metadata = {
  title: "Leadflow · Design outreach with us",
  description:
    "Leadflow is the AI-guided outreach studio: chat a brief, approve a sequence, and let Leadflow enrich Apollo leads, send via Resend, and surface replies worth acting on.",
};

const PIPELINE = [
  { title: "Chat the brief", desc: "Tell Studio who you're targeting and what to say — no forms, just a conversation." },
  { title: "Enrich & import", desc: "We draft an Apollo search, verify contacts, and land them in Leadflow ready to sequence." },
  { title: "Send the sequence", desc: "Resend delivers each step on schedule, with opens, clicks, and bounces tracked end to end." },
  { title: "Reply & book", desc: "Inbox triage surfaces real interest so you spend time on calls, not sorting email." },
] as const;

const FEATURES = [
  {
    icon: ChatIcon,
    title: "Studio",
    desc: "An AI co-pilot that turns a plain-English brief into a lead search and a full email sequence — approve once, then it runs.",
  },
  {
    icon: SearchIcon,
    title: "Apollo enrich",
    desc: "Search Apollo's database from Studio or by hand, then import verified emails and firmographic data in one step.",
  },
  {
    icon: SendIcon,
    title: "Campaigns",
    desc: "Multi-step sequences with per-step delays, merge fields, and live send/open/click/reply tracking via Resend.",
  },
  {
    icon: MailIcon,
    title: "Inbox",
    desc: "Replies are triaged automatically — interested, booked, not interested, or a question — so nothing worth acting on gets buried.",
  },
  {
    icon: CalendarDotIcon,
    title: "Calendar",
    desc: "Connect Google Calendar, an iCal feed, or a booking link to see what's coming up without leaving Leadflow.",
  },
  {
    icon: UsersIcon,
    title: "Team",
    desc: "Invite teammates with their own Apollo and AI credit limits, and keep an eye on activity from one Oversight view.",
  },
] as const;

const USE_CASES = ["Cold outreach", "Recruiting", "Investor outreach", "Partnerships"] as const;

export default function MarketingHomePage() {
  return (
    <>
      <section className="lf-mkt-hero">
        <div className="lf-mkt-hero-dots" aria-hidden />
        <div className="lf-mkt-hero-inner">
          <div>
            <span className="lf-mkt-hero-eyebrow">
              <span className="lf-mkt-hero-eyebrow-dot" aria-hidden />
              Private beta
            </span>
            <h1 className="lf-mkt-hero-headline">
              Design outreach <em>with us</em>.
            </h1>
            <p className="lf-mkt-hero-sub">
              Leadflow is an AI-guided outreach studio. Chat with it to plan a sequence, approve it
              once, then let it enrich Apollo leads, send via Resend, and surface the replies worth
              acting on.
            </p>
            <div className="lf-mkt-hero-actions">
              <WaitlistButton className="lf-btn lf-btn-primary">Join the waitlist</WaitlistButton>
              <Link href="/pricing" className="lf-btn lf-mkt-btn-ghost-light">
                See pricing
              </Link>
            </div>
            <p className="lf-mkt-hero-foot">
              A product of Inferaform — currently onboarding teams from the waitlist.
            </p>
          </div>

          <div className="lf-mkt-hero-visual" aria-hidden>
            <div className="lf-mkt-hero-visual-bar">
              <span className="lf-mkt-hero-visual-dot" />
              <span className="lf-mkt-hero-visual-dot" />
              <span className="lf-mkt-hero-visual-dot" />
              <span className="lf-mkt-hero-visual-label">Studio</span>
            </div>
            <div className="lf-mkt-hero-visual-body">
              <p className="lf-mkt-hero-bubble-assistant">
                Let&rsquo;s plan your outreach. Who are we targeting?
              </p>
              <p className="lf-mkt-hero-bubble-user">Series A recruiters in fintech, US only.</p>
              <p className="lf-mkt-hero-bubble-assistant">
                Got it — drafting a 4-step sequence and an Apollo search now.
              </p>
              <div className="lf-mkt-hero-artifact">
                <div className="lf-mkt-hero-artifact-head">
                  <SendIcon width={14} height={14} />
                  Outreach plan
                </div>
                <div className="lf-mkt-hero-artifact-row">
                  <span className="lf-mkt-hero-artifact-row-index">1</span>
                  Apollo search — 340 leads matched
                </div>
                <div className="lf-mkt-hero-artifact-row">
                  <span className="lf-mkt-hero-artifact-row-index">2</span>
                  Sequence — 4 steps over 9 days
                </div>
                <div className="lf-mkt-hero-artifact-row">
                  <span className="lf-mkt-hero-artifact-row-index">3</span>
                  Send window — Tue–Thu mornings
                </div>
              </div>
            </div>
            <div className="lf-mkt-hero-visual-foot">
              <span className="lf-mkt-hero-visual-status">
                <span className="lf-status-dot is-done" aria-hidden />
                Ready to approve
              </span>
              <span className="lf-mkt-hero-visual-status">Studio</span>
            </div>
          </div>
        </div>
      </section>

      <section className="lf-mkt-section" id="how-it-works">
        <div className="lf-mkt-section-inner">
          <div className="lf-mkt-section-head lf-mkt-section-head--center">
            <span className="lf-mkt-eyebrow">How it works</span>
            <h2 className="lf-mkt-h2">From a brief to a booked call, in four steps.</h2>
            <p className="lf-mkt-lede">
              The whole pipeline lives in one place — no spreadsheet handoffs between finding
              leads, writing copy, and tracking replies.
            </p>
          </div>

          <div className="lf-mkt-pipeline">
            {PIPELINE.map((step, index) => (
              <div key={step.title} className="lf-mkt-pipeline-step">
                <span className="lf-mkt-pipeline-index">{index + 1}</span>
                <p className="lf-mkt-pipeline-title">{step.title}</p>
                <p className="lf-mkt-pipeline-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lf-mkt-section lf-mkt-section--flush-top">
        <div className="lf-mkt-section-inner">
          <div className="lf-mkt-section-head lf-mkt-section-head--center">
            <span className="lf-mkt-eyebrow">Everything in one place</span>
            <h2 className="lf-mkt-h2">One outreach studio, not five disconnected tools.</h2>
            <p className="lf-mkt-lede">
              Leadflow replaces the usual stack of a search tool, a sequencer, a shared inbox, and
              a spreadsheet of who-said-what.
            </p>
          </div>

          <div className="lf-mkt-feature-grid">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="lf-mkt-feature-tile">
                <span className="lf-mkt-feature-icon">
                  <feature.icon />
                </span>
                <h3 className="lf-mkt-feature-title">{feature.title}</h3>
                <p className="lf-mkt-feature-desc">{feature.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link href="/features" className="lf-btn lf-btn-ghost">
              See every feature in detail
            </Link>
          </div>
        </div>
      </section>

      <section className="lf-mkt-section lf-mkt-section--tight">
        <div className="lf-mkt-section-inner">
          <div className="lf-mkt-section-head lf-mkt-section-head--center">
            <span className="lf-mkt-eyebrow">Built for</span>
            <h2 className="lf-mkt-h2">Teams designing outreach that isn&rsquo;t spam.</h2>
            <p className="lf-mkt-lede">
              We&rsquo;re still in private beta, onboarding a handful of teams from the waitlist at
              a time across use cases like these.
            </p>
          </div>

          <div className="lf-mkt-usecases">
            {USE_CASES.map((useCase) => (
              <span key={useCase} className="lf-mkt-usecase-chip">
                <span className="lf-mkt-usecase-chip-dot" aria-hidden />
                {useCase}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="lf-mkt-cta-band">
        <div className="lf-mkt-section lf-mkt-section-inner">
          <span className="lf-mkt-eyebrow lf-mkt-eyebrow--light">Ready when you are</span>
          <h2 className="lf-mkt-h2">Design outreach with us.</h2>
          <p className="lf-mkt-lede">
            Join the waitlist and we&rsquo;ll reach out as we onboard the next batch of teams —
            or talk to us directly if you&rsquo;d rather skip ahead.
          </p>
          <div className="lf-mkt-cta-actions">
            <WaitlistButton className="lf-btn lf-btn-primary">Join the waitlist</WaitlistButton>
            <Link href="/contact" className="lf-btn lf-mkt-btn-ghost-light">
              Talk to us
            </Link>
          </div>
          <p className="lf-mkt-cta-note">
            <CheckIcon width={14} height={14} className="mr-1.5" />
            No credit card during the private beta.
          </p>
        </div>
      </section>
    </>
  );
}
