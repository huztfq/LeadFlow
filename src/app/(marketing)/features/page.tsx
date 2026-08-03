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
  title: "Features · Leadflow",
  description:
    "A deep dive into Leadflow's Studio, Apollo enrichment, Campaigns, Inbox, Calendar, and Team features.",
};

type DeepDive = {
  index: string;
  icon: typeof ChatIcon;
  title: string;
  desc: string;
  points: string[];
  screen: { label: string; rows: { icon: typeof ChatIcon; text: string }[] };
};

const DEEP_DIVES: DeepDive[] = [
  {
    index: "01",
    icon: ChatIcon,
    title: "Studio",
    desc: "Chat with an AI co-pilot to turn a plain-English brief into a lead search and a full email sequence — then approve it once and it runs.",
    points: [
      "Describe who you're targeting and what to say, in your own words",
      "Studio drafts an Apollo search and a multi-step sequence together",
      "Every chat is saved, so you can pick a plan back up or fork a variant",
      "Nothing sends until you approve the plan",
    ],
    screen: {
      label: "Studio",
      rows: [
        { icon: ChatIcon, text: "\u201cFind fintech recruiters at Series A companies\u201d" },
        { icon: SendIcon, text: "Draft plan: 340 leads · 4-step sequence" },
        { icon: CheckIcon, text: "Approved — ready to enrich & send" },
      ],
    },
  },
  {
    index: "02",
    icon: SearchIcon,
    title: "Apollo enrich",
    desc: "Search Apollo's database from Studio or by hand on the Search page, then import verified emails and firmographic data in one step.",
    points: [
      "Filter by title, company, industry, and location",
      "Preview results before spending a single credit",
      "Import verified contacts straight into Leadflow, ready to sequence",
      "Per-teammate Apollo credit limits keep usage predictable",
    ],
    screen: {
      label: "Search",
      rows: [
        { icon: SearchIcon, text: "VP Sales · Series A–B · United States" },
        { icon: CheckIcon, text: "128 verified contacts found" },
        { icon: SendIcon, text: "Import 40 selected leads" },
      ],
    },
  },
  {
    index: "03",
    icon: SendIcon,
    title: "Campaigns",
    desc: "Multi-step sequences with per-step delays and merge fields, sent through Resend with opens, clicks, replies, and bounces tracked end to end.",
    points: [
      "Build sequences with as many steps and delays as you need",
      "Personalize with merge fields pulled from each lead's data",
      "A daily send worker paces delivery automatically",
      "Every send, open, click, and bounce is logged per lead",
    ],
    screen: {
      label: "Campaigns",
      rows: [
        { icon: SendIcon, text: "Step 2 of 4 · sends in 3 days" },
        { icon: MailIcon, text: "62% open rate this week" },
        { icon: CheckIcon, text: "9 replies flagged as interested" },
      ],
    },
  },
  {
    index: "04",
    icon: MailIcon,
    title: "Inbox",
    desc: "Replies are matched to the right lead and campaign, then triaged automatically so you can spend time on conversations, not sorting email.",
    points: [
      "AI categorization: interested, booked, question, not interested, and more",
      "A stats strip shows sent, opened, replied, and booked at a glance",
      "Override any category by hand in one click",
      "Booked replies can drop a placeholder straight onto your Calendar",
    ],
    screen: {
      label: "Inbox",
      rows: [
        { icon: MailIcon, text: "\u201cThis looks great, can we talk Tuesday?\u201d" },
        { icon: CheckIcon, text: "Categorized: booked (94% confidence)" },
        { icon: CalendarDotIcon, text: "Added to Calendar" },
      ],
    },
  },
  {
    index: "05",
    icon: CalendarDotIcon,
    title: "Calendar",
    desc: "Connect the calendar you already use — Google, an iCal feed, or a plain booking link — and see what's coming up without leaving Leadflow.",
    points: [
      "Google Calendar OAuth for a live, read-only agenda",
      "Or paste a secret iCal feed URL — no OAuth required",
      "Or just link a Calendly/Cal.com booking page",
      "Booked replies from the Inbox show up alongside everything else",
    ],
    screen: {
      label: "Calendar",
      rows: [
        { icon: CalendarDotIcon, text: "Tue 10:00 — Intro call w/ Dana K." },
        { icon: CalendarDotIcon, text: "Wed 14:30 — Fintech recruiting sync" },
        { icon: CheckIcon, text: "Synced from Google Calendar" },
      ],
    },
  },
  {
    index: "06",
    icon: UsersIcon,
    title: "Team",
    desc: "Invite teammates with their own Apollo and AI credit limits, and keep an eye on activity across the workspace from one Oversight view.",
    points: [
      "Invite by email — accept links work with or without Google sign-in",
      "Set per-teammate Apollo and AI credit limits (blank means unlimited)",
      "Everyone sees their own usage; owners see the whole team's",
      "Oversight gives owners a feed of what's happening across the workspace",
    ],
    screen: {
      label: "Team",
      rows: [
        { icon: UsersIcon, text: "3 teammates · 1 pending invite" },
        { icon: CheckIcon, text: "Apollo credits: 210 / 500 used" },
        { icon: SearchIcon, text: "Oversight: 12 searches today" },
      ],
    },
  },
];

export default function FeaturesPage() {
  return (
    <>
      <section className="lf-mkt-page-hero">
        <div className="lf-mkt-page-hero-inner">
          <span className="lf-mkt-eyebrow">Features</span>
          <h1 className="lf-mkt-h2">Everything from brief to booked call.</h1>
          <p className="lf-mkt-lede lf-mkt-lede--center">
            Six pieces that work as one pipeline — planned with an AI co-pilot, run through
            Apollo and Resend, and tracked all the way to the reply.
          </p>
        </div>
      </section>

      <section className="lf-mkt-section">
        <div className="lf-mkt-section-inner">
          <div className="lf-mkt-deepdive">
            {DEEP_DIVES.map((section, index) => (
              <div
                key={section.title}
                className={index % 2 === 1 ? "lf-mkt-deepdive-row lf-mkt-deepdive-row--reverse" : "lf-mkt-deepdive-row"}
              >
                <div className="lf-mkt-deepdive-text">
                  <span className="lf-mkt-deepdive-index">{section.index}</span>
                  <h2 className="lf-mkt-deepdive-title">{section.title}</h2>
                  <p className="lf-mkt-deepdive-desc">{section.desc}</p>
                  <div className="lf-mkt-deepdive-list">
                    {section.points.map((point) => (
                      <div key={point} className="lf-mkt-deepdive-list-item">
                        <CheckIcon width={15} height={15} className="lf-mkt-deepdive-list-icon" />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lf-mkt-screen" aria-hidden>
                  <div className="lf-mkt-screen-bar">
                    <span className="lf-mkt-screen-dot" />
                    <span className="lf-mkt-screen-dot" />
                    <span className="lf-mkt-screen-dot" />
                    <span className="lf-mkt-screen-label">{section.screen.label}</span>
                  </div>
                  <div className="lf-mkt-screen-body">
                    {section.screen.rows.map((row) => (
                      <div key={row.text} className="lf-mkt-screen-row">
                        <span className="lf-mkt-screen-row-icon">
                          <row.icon width={14} height={14} />
                        </span>
                        <span>{row.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lf-mkt-cta-band">
        <div className="lf-mkt-section lf-mkt-section-inner">
          <span className="lf-mkt-eyebrow lf-mkt-eyebrow--light">Like what you see?</span>
          <h2 className="lf-mkt-h2">Design outreach with us.</h2>
          <p className="lf-mkt-lede">
            Join the waitlist and we&rsquo;ll bring you in as we onboard the next batch of teams.
          </p>
          <div className="lf-mkt-cta-actions">
            <WaitlistButton className="lf-btn lf-btn-primary">Join the waitlist</WaitlistButton>
            <Link href="/pricing" className="lf-btn lf-mkt-btn-ghost-light">
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
