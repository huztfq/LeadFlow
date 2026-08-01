type LeadFields = {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  title?: string | null;
};

export function renderTemplate(template: string, lead: LeadFields): string {
  const map: Record<string, string> = {
    firstName: lead.firstName ?? "",
    lastName: lead.lastName ?? "",
    company: lead.company ?? "",
    title: lead.title ?? "",
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => map[key] ?? "");
}
