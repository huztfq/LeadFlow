export type LeadRow = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  title: string | null;
  company: string | null;
  industry: string | null;
  location: string | null;
  phone: string | null;
};

export function leadsToCsv(leads: LeadRow[]): string {
  const header = [
    "firstName",
    "lastName",
    "email",
    "title",
    "company",
    "industry",
    "location",
    "phone",
  ];
  const escape = (v: string | null | undefined) => {
    const s = v ?? "";
    return `"${s.replaceAll('"', '""')}"`;
  };
  const lines = [
    header.join(","),
    ...leads.map((l) =>
      [
        l.firstName,
        l.lastName,
        l.email,
        l.title,
        l.company,
        l.industry,
        l.location,
        l.phone,
      ]
        .map(escape)
        .join(","),
    ),
  ];
  return lines.join("\n");
}
