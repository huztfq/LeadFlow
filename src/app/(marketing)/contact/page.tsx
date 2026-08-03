import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/contact-form";
import { MailIcon, PhoneIcon, BuildingIcon } from "@/components/marketing/marketing-icons";

export const metadata: Metadata = {
  title: "Contact · Leadflow",
  description: "Get in touch with the Inferaform team about Leadflow — sales, partnerships, or support.",
};

const INFO = [
  {
    icon: MailIcon,
    title: "Email",
    desc: "hello@inferaform.com — we typically reply within 1–2 business days.",
  },
  {
    icon: BuildingIcon,
    title: "For teams & partnerships",
    desc: "Tell us about your team and what you're hoping to use Leadflow for — we read every message.",
  },
  {
    icon: PhoneIcon,
    title: "Already invited?",
    desc: "If you have an account, sign in and use in-app support instead of this form for faster help.",
  },
] as const;

export default function ContactPage() {
  return (
    <section className="lf-mkt-section">
      <div className="lf-mkt-section-inner">
        <div className="lf-mkt-section-head mb-12">
          <span className="lf-mkt-eyebrow">Contact</span>
          <h1 className="lf-mkt-h2">Talk to the team building Leadflow.</h1>
          <p className="lf-mkt-lede">
            Whether you&rsquo;re asking about the beta, pricing, or a partnership — send us a note
            and a real person will get back to you.
          </p>
        </div>

        <div className="lf-mkt-contact-grid">
          <div className="lf-mkt-contact-info">
            {INFO.map((item) => (
              <div key={item.title} className="lf-mkt-contact-info-item">
                <span className="lf-mkt-contact-info-icon">
                  <item.icon />
                </span>
                <div>
                  <p className="lf-mkt-contact-info-title">{item.title}</p>
                  <p className="lf-mkt-contact-info-desc">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <ContactForm />
        </div>
      </div>
    </section>
  );
}
