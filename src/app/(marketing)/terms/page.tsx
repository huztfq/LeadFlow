import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · Leadflow",
  description: "The terms that govern use of Leadflow, a product of Inferaform.",
};

const SECTIONS = [
  { id: "acceptance", label: "Acceptance of terms" },
  { id: "the-service", label: "The service & private beta" },
  { id: "accounts", label: "Accounts & security" },
  { id: "acceptable-use", label: "Acceptable use" },
  { id: "billing", label: "Subscriptions & billing" },
  { id: "your-content", label: "Your content & data" },
  { id: "intellectual-property", label: "Intellectual property" },
  { id: "third-party", label: "Third-party services" },
  { id: "termination", label: "Termination" },
  { id: "disclaimers", label: "Disclaimers" },
  { id: "liability", label: "Limitation of liability" },
  { id: "indemnification", label: "Indemnification" },
  { id: "governing-law", label: "Governing law" },
  { id: "changes", label: "Changes to these terms" },
  { id: "contact", label: "Contact us" },
] as const;

export default function TermsPage() {
  return (
    <section className="lf-mkt-section">
      <div className="lf-mkt-section-inner lf-mkt-section-inner--narrow lf-mkt-legal">
        <div>
          <span className="lf-mkt-eyebrow">Legal</span>
          <h1 className="lf-mkt-h2">Terms of Service</h1>
          <p className="lf-mkt-legal-updated">Last updated: August 2026</p>
        </div>

        <p className="lf-mkt-legal-intro">
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Leadflow, a
          product of Inferaform (&ldquo;Inferaform,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
          &ldquo;our&rdquo;), including our marketing site, waitlist, and the authenticated
          application (together, the &ldquo;Service&rdquo;). By accessing or using the Service,
          you agree to be bound by these Terms.
        </p>

        <nav className="lf-mkt-legal-toc" aria-label="Sections">
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.label}
            </a>
          ))}
        </nav>

        <div className="lf-mkt-legal-section" id="acceptance">
          <h2>1. Acceptance of terms</h2>
          <p>
            By creating an account, accepting an invite, joining the waitlist, or otherwise using
            the Service, you confirm that you can form a binding contract with Inferaform and that
            you accept these Terms and our <a href="/privacy">Privacy Policy</a>. If you use the
            Service on behalf of an organization, you represent that you have authority to bind
            that organization to these Terms.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="the-service">
          <h2>2. The service & private beta</h2>
          <p>
            Leadflow is currently offered as an invite-only <strong>private beta</strong>. Features,
            availability, and pricing may change, and the Service is provided without the
            uptime or support commitments of a general-availability product. We&rsquo;ll aim to
            give reasonable notice of material changes, but the beta nature of the Service means
            things may move faster than they would post-launch.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="accounts">
          <h2>3. Accounts & security</h2>
          <p>
            Access to the app is invite-only. You&rsquo;re responsible for keeping your login
            credentials confidential and for all activity that happens under your account. Notify
            us immediately if you suspect unauthorized access. Workspace owners are responsible for
            the teammates they invite and the credit limits they assign them.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="acceptable-use">
          <h2>4. Acceptable use</h2>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Send unsolicited bulk email in violation of applicable law (e.g. CAN-SPAM, CASL, GDPR/PECR);</li>
            <li>Harvest or import contact data you do not have a lawful basis to contact;</li>
            <li>Send content that is fraudulent, deceptive, defamatory, or infringing;</li>
            <li>Attempt to disrupt, reverse-engineer, or gain unauthorized access to the Service; or</li>
            <li>Use the Service to violate the terms of Apollo, Resend, Anthropic, or Google.</li>
          </ul>
          <p>
            Every campaign sent through Leadflow must honor unsubscribe requests, and recipients
            must always be able to opt out via the link included in each message.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="billing">
          <h2>5. Subscriptions & billing</h2>
          <p>
            During the private beta, access is free for invited workspaces — see{" "}
            <a href="/pricing">Pricing</a> for what plans are expected to look like at general
            availability. If and when paid plans take effect, we will notify affected workspaces in
            advance of any charge, and continued use of the Service after that notice constitutes
            acceptance of the applicable plan&rsquo;s terms. No refunds are owed for beta-period use,
            since no charge is made during that time.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="your-content">
          <h2>6. Your content & data</h2>
          <p>
            You retain ownership of the lead data, sequences, and messages you create or import
            into Leadflow (&ldquo;Your Content&rdquo;). You grant Inferaform a limited license to
            host, process, and transmit Your Content solely to operate and improve the Service
            (for example, sending your campaigns via Resend or categorizing replies with Claude).
            You&rsquo;re responsible for having the rights and lawful basis needed to contact the
            leads you import.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="intellectual-property">
          <h2>7. Intellectual property</h2>
          <p>
            The Service, including its software, design, and branding, is owned by Inferaform and
            protected by intellectual property laws. These Terms don&rsquo;t grant you any right to
            use Inferaform&rsquo;s or Leadflow&rsquo;s trademarks or branding without our written
            permission.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="third-party">
          <h2>8. Third-party services</h2>
          <p>
            Leadflow integrates with third-party services — including Apollo.io, Resend, Anthropic,
            and Google — to deliver its features. Your use of those integrations may also be
            subject to the applicable third party&rsquo;s own terms, and Inferaform is not
            responsible for their availability or acts and omissions.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="termination">
          <h2>9. Termination</h2>
          <p>
            You may stop using the Service at any time. We may suspend or terminate access to the
            Service — for a workspace or an individual account — if we reasonably believe these
            Terms have been violated, or as needed to protect the Service or other users. Upon
            termination, your right to use the Service ends, though certain provisions of these
            Terms (e.g. intellectual property, disclaimers, limitation of liability) survive.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="disclaimers">
          <h2>10. Disclaimers</h2>
          <p>
            THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT
            WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. AS A PRIVATE
            BETA PRODUCT, LEADFLOW MAY CONTAIN BUGS, EXPERIENCE DOWNTIME, OR CHANGE WITHOUT NOTICE.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="liability">
          <h2>11. Limitation of liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, INFERAFORM WILL NOT BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS,
            REVENUE, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY
            FOR ANY CLAIM RELATED TO THE SERVICE WILL NOT EXCEED THE AMOUNT YOU PAID INFERAFORM IN
            THE 12 MONTHS BEFORE THE CLAIM AROSE (WHICH, DURING THE FREE PRIVATE BETA, IS ZERO).
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="indemnification">
          <h2>12. Indemnification</h2>
          <p>
            You agree to indemnify and hold Inferaform harmless from any claims, damages, or
            expenses (including reasonable legal fees) arising from your use of the Service, Your
            Content, or your violation of these Terms or applicable law.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="governing-law">
          <h2>13. Governing law</h2>
          <p>
            These Terms are governed by applicable law in the jurisdiction where Inferaform is
            established, without regard to conflict-of-law principles, unless a different law is
            required by mandatory consumer protection rules where you live.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="changes">
          <h2>14. Changes to these terms</h2>
          <p>
            We may update these Terms as the Service evolves, especially moving out of private
            beta. We&rsquo;ll update the &ldquo;Last updated&rdquo; date above and make a
            reasonable effort to notify active accounts of material changes.
          </p>
        </div>

        <div className="lf-mkt-legal-section" id="contact">
          <h2>15. Contact us</h2>
          <p>
            Questions about these Terms? Use the <a href="/contact">contact page</a>, or email{" "}
            <a href="mailto:hello@inferaform.com">hello@inferaform.com</a>.
          </p>
        </div>
      </div>
    </section>
  );
}
