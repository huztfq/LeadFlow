import type { Metadata } from "next";
import Link from "next/link";
import { WaitlistButton } from "@/components/waitlist-modal";
import { CompassIcon, HeartHandshakeIcon, TargetIcon } from "@/components/marketing/marketing-icons";

export const metadata: Metadata = {
  title: "About · Leadflow",
  description: "Why Inferaform built Leadflow, and how it approaches outreach.",
};

const TENETS = [
  {
    icon: TargetIcon,
    title: "Chat first, click once",
    desc: "Outreach starts as a conversation, not a form with forty fields. You describe the brief; Studio drafts the search and the sequence for you to approve.",
  },
  {
    icon: CompassIcon,
    title: "One pipeline, not five tabs",
    desc: "Finding leads, writing sequences, sending email, and reading replies live in one place — so nothing gets lost between a spreadsheet and a sending tool.",
  },
  {
    icon: HeartHandshakeIcon,
    title: "Outreach that isn't spam",
    desc: "Sequences are built to be specific and easy to reply to, and every send is unsubscribe-honest — because the goal is a conversation, not a blast.",
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <section className="lf-mkt-page-hero">
        <div className="lf-mkt-page-hero-inner">
          <span className="lf-mkt-eyebrow">About</span>
          <h1 className="lf-mkt-h2">A small studio building the outreach tool we wanted.</h1>
          <p className="lf-mkt-lede lf-mkt-lede--center">
            Leadflow is a product of Inferaform — built for anyone who&rsquo;s ever opened a lead
            list, a sequencer, and a shared inbox in three different tabs just to send one campaign.
          </p>
        </div>
      </section>

      <section className="lf-mkt-section lf-mkt-section--tight">
        <div className="lf-mkt-section-inner lf-mkt-section-inner--narrow">
          <div className="lf-mkt-prose">
            <p>
              <strong>Inferaform</strong> builds focused software for people who&rsquo;d rather
              spend their time on conversations than on tools. Leadflow is our first product:
              an outreach studio built around a simple idea — that planning a cold email campaign
              should feel like talking to a sharp colleague, not filling out a wizard.
            </p>
            <p>
              Most outreach stacks make you stitch together a lead database, a sequencer, a
              shared inbox, and a spreadsheet to track who replied. Leadflow puts that whole
              pipeline in one place: chat with Studio to plan a search and a sequence, approve it
              once, and let Leadflow enrich Apollo leads, send through Resend, and triage what
              comes back.
            </p>
            <p>
              We&rsquo;re still early. Leadflow is in private beta, onboarding a handful of teams
              from the waitlist at a time so we can build with real feedback instead of guessing.
              If that sounds like the way you&rsquo;d want to build outreach software too,
              we&rsquo;d love to hear from you.
            </p>
          </div>

          <div className="lf-mkt-about-tenets">
            {TENETS.map((tenet) => (
              <div key={tenet.title} className="lf-mkt-feature-tile">
                <span className="lf-mkt-feature-icon">
                  <tenet.icon />
                </span>
                <h3 className="lf-mkt-feature-title">{tenet.title}</h3>
                <p className="lf-mkt-feature-desc">{tenet.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lf-mkt-cta-band">
        <div className="lf-mkt-section lf-mkt-section-inner">
          <span className="lf-mkt-eyebrow lf-mkt-eyebrow--light">Want in?</span>
          <h2 className="lf-mkt-h2">Design outreach with us.</h2>
          <p className="lf-mkt-lede">
            Join the waitlist, or reach out directly if you&rsquo;d like to talk to the team first.
          </p>
          <div className="lf-mkt-cta-actions">
            <WaitlistButton className="lf-btn lf-btn-primary">Join the waitlist</WaitlistButton>
            <Link href="/contact" className="lf-btn lf-mkt-btn-ghost-light">
              Get in touch
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
