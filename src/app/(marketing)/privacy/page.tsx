import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Leadflow",
  description: "How Inferaform collects, uses, and protects data for Leadflow.",
};

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "information-we-collect", label: "Information we collect" },
  { id: "how-we-use-information", label: "How we use information" },
  { id: "cookies", label: "Cookies & tracking" },
  { id: "third-parties", label: "Third-party services" },
  { id: "retention", label: "Data retention" },
  { id: "security", label: "Data security" },
  { id: "your-rights", label: "Your rights" },
  { id: "children", label: "Children's privacy" },
  { id: "international", label: "International transfers" },
  { id: "changes", label: "Changes to this policy" },
  { id: "contact", label: "Contact us" },
] as const;

export default function PrivacyPage() {
  return (
    <section className="lf-mkt-section">
      <div className="lf-mkt-section-inner lf-mkt-section-inner--narrow lf-mkt-legal">
        <div>
          <span className="lf-mkt-eyebrow">Legal</span>
          <h1 className="lf-mkt-h2">Privacy Policy</h1>
          <p className="lf-mkt-legal-updated">Last updated: August 2026</p>
        </div>

        <p className="lf-mkt-legal-intro">
          Inferaform (&ldquo;Inferaform,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) built
          Leadflow (the &ldquo;Service&rdquo;). This policy explains what we collect, why, and the
          choices you have. Leadflow is currently in private beta and access is invite-only; this
          policy applies to the waitlist, the marketing site, and the app itself.
        </p>

        <nav className="lf-mkt-legal-toc" aria-label="Sections">
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.label}
            </a>
          ))}
        </nav>

        <div className="lf-mkt-legal-section" id="overview">
          <h2>1. Overview</h2>
          <p>
            This Privacy Policy describes how Inferaform collects, uses, discloses, and safeguards
            information in connection with Leadflow, including our marketing site, waitlist,
            contact form, and the authenticated application used by invited teams. By using the
            Service, you agree to the collection and use of information as described here.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="information-we-collect">
          <h2>2. Information we collect</h2>
          <p>We collect information in a few ways:</p>
          <ul>
            <li>
              <strong>Account information</strong> — name, email address, and password hash for
              anyone we invite into the app, and profile details you choose to add (username,
              first/last name, preferences).
            </li>
            <li>
              <strong>Waitlist and contact submissions</strong> — the name, email, and any message
              or use-case you submit through the waitlist form or the contact page.
            </li>
            <li>
              <strong>Lead and campaign data</strong> — contact records you search for or import
              via Apollo, the outreach sequences and messages you create, and delivery data
              (sends, opens, clicks, replies, bounces) for campaigns you run.
            </li>
            <li>
              <strong>Calendar data</strong> — if you connect Google Calendar, an iCal feed, or a
              booking link, we access event details needed to show your agenda inside Leadflow.
            </li>
            <li>
              <strong>Usage and device data</strong> — basic technical information such as IP
              address, browser type, and pages visited, collected automatically when you use the
              Service.
            </li>
          </ul>
        </div>

        <div className="lf-mkt-legal-section" id="how-we-use-information">
          <h2>3. How we use information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, operate, and maintain the Service, including Studio, Campaigns, Inbox, and Calendar;</li>
            <li>Authenticate accounts and keep the Service secure;</li>
            <li>Send transactional email, such as invite links, unsubscribe confirmations, and account notices;</li>
            <li>Follow up on waitlist signups and contact form submissions;</li>
            <li>Categorize inbound replies and draft outreach content using AI (Anthropic Claude);</li>
            <li>Monitor, debug, and improve the Service; and</li>
            <li>Comply with legal obligations and enforce our Terms of Service.</li>
          </ul>
        </div>

        <div className="lf-mkt-legal-section" id="cookies">
          <h2>4. Cookies & tracking</h2>
          <p>
            Leadflow uses a single first-party session cookie to keep you signed in — it is not
            used for advertising or cross-site tracking. We don&rsquo;t currently use third-party
            analytics or advertising cookies on the marketing site. Outbound campaign emails may
            include open and click tracking (via Resend) so senders can see engagement on their
            own campaigns; recipients can always unsubscribe from a specific sender&rsquo;s emails using
            the link included in every message.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="third-parties">
          <h2>5. Third-party services</h2>
          <p>
            Leadflow relies on a small number of infrastructure providers to operate. We share the
            minimum data necessary with each for the purpose described:
          </p>
          <ul>
            <li><strong>Apollo.io</strong> — to search for and enrich prospect contact data you request.</li>
            <li><strong>Resend</strong> — to deliver campaign emails and transactional messages, and report delivery events.</li>
            <li><strong>Anthropic (Claude)</strong> — to power Studio&rsquo;s chat planning and inbox reply categorization.</li>
            <li><strong>Google</strong> — for optional Google sign-in and Google Calendar integration, only for accounts that connect it.</li>
            <li><strong>Supabase (PostgreSQL)</strong> — to store application data securely.</li>
            <li><strong>Vercel</strong> — to host the application and run scheduled jobs.</li>
          </ul>
          <p>
            These providers process data on our behalf under their own privacy and security
            commitments; we do not sell personal information to anyone.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="retention">
          <h2>6. Data retention</h2>
          <p>
            We retain account and campaign data for as long as your workspace remains active, plus
            a reasonable period afterward to comply with legal, accounting, or security
            requirements. Waitlist and contact submissions are retained until we&rsquo;ve followed up or
            you ask us to delete them. You can request deletion at any time — see{" "}
            <a href="#contact">Contact us</a> below.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="security">
          <h2>7. Data security</h2>
          <p>
            We use industry-standard safeguards — encrypted connections (TLS), hashed passwords,
            and access controls scoped to your workspace — to protect information in transit and
            at rest. No method of transmission or storage is perfectly secure, so we can&rsquo;t
            guarantee absolute security, but we work to keep these protections current.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="your-rights">
          <h2>8. Your rights</h2>
          <p>
            Depending on where you live, you may have the right to access, correct, export, or
            delete your personal information, or to object to or restrict certain processing.
            Account holders can update most information directly from Settings; for anything else,
            or for waitlist/contact data, reach out via the <a href="/contact">contact page</a> and
            we&rsquo;ll respond promptly.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="children">
          <h2>9. Children&rsquo;s privacy</h2>
          <p>
            Leadflow is a business tool and is not directed at children. We do not knowingly
            collect personal information from anyone under 16. If you believe a child has provided
            us with personal information, contact us and we will delete it.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="international">
          <h2>10. International transfers</h2>
          <p>
            Our infrastructure providers may process and store data in countries other than your
            own. Where required, we rely on appropriate safeguards (such as standard contractual
            clauses) to protect information transferred internationally.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="changes">
          <h2>11. Changes to this policy</h2>
          <p>
            We may update this policy as Leadflow evolves, especially as we move out of private
            beta. We&rsquo;ll update the &ldquo;Last updated&rdquo; date above and, for material
            changes, make a reasonable effort to notify active accounts directly.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="contact">
          <h2>12. Contact us</h2>
          <p>
            Questions about this policy or a request about your data? Use the{" "}
            <a href="/contact">contact page</a>, or email{" "}
            <a href="mailto:hello@inferaform.com">hello@inferaform.com</a>.
          </p>
        </div>
      </div>
    </section>
  );
}
