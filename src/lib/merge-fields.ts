export type LeadFields = {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  title?: string | null;
  industry?: string | null;
  location?: string | null;
  opener?: string | null;
};

export function renderTemplate(template: string, lead: LeadFields): string {
  const map: Record<string, string> = {
    firstName: lead.firstName ?? "",
    lastName: lead.lastName ?? "",
    company: lead.company ?? "",
    title: lead.title ?? "",
    industry: lead.industry ?? "",
    location: lead.location ?? "",
    opener: lead.opener ?? "",
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => map[key] ?? "");
}

/** Existing campaigns may not include {{opener}}; insert a slot so send-time copy still lands. */
export function ensureOpenerSlot(bodyHtml: string): string {
  if (/\{\{\s*opener\s*\}\}/.test(bodyHtml)) return bodyHtml;
  const greeting = bodyHtml.match(/^(<p[^>]*>\s*Hi \{\{firstName\}\},?\s*<\/p>)/i);
  if (greeting) {
    return `${greeting[1]}\n<p>{{opener}}</p>${bodyHtml.slice(greeting[0].length)}`;
  }
  return `<p>{{opener}}</p>\n${bodyHtml}`;
}

/** Drop empty opener paragraphs left when personalization had nothing to say. */
export function stripEmptyOpenerParagraphs(html: string): string {
  return html.replace(/<p>\s*<\/p>/gi, "").replace(/\n{3,}/g, "\n\n");
}
