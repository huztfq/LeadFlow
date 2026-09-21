export const BOOKING_URL = "https://calendar.app.google/3nUST4xsqchDzfdUA";

export function buildBookingCta(): string {
  return `<p style="margin-top:20px;">If 15 minutes would help, grab a time here: <a href="${BOOKING_URL}">https://calendar.app.google/3nUST4xsqchDzfdUA</a></p>`;
}

export function buildCampaignFooter(unsubscribeUrl: string): string {
  return (
    `<p style="margin-top:24px;font-size:12px;color:#71717a;">` +
    `Sent by Inferaform. Don't want these emails? <a href="${unsubscribeUrl}">Unsubscribe</a>.` +
    `</p>`
  );
}

/** Appends the booking link (once) and Inferaform footer. */
export function appendCampaignChrome(html: string, unsubscribeUrl: string): string {
  const withBooking = html.includes(BOOKING_URL) ? html : `${html}${buildBookingCta()}`;
  return `${withBooking}${buildCampaignFooter(unsubscribeUrl)}`;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  bull: "•",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

/**
 * Plain-text alternative for a campaign email. Keeps link targets visible
 * (`label (https://…)`) so the text part is usable on its own, which is
 * also what spam filters expect from a multipart message.
 */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => {
      const plainLabel = label.replace(/<[^>]+>/g, "").trim();
      if (!plainLabel || plainLabel === href) return href;
      return `${plainLabel} (${href})`;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return decodeEntities(text);
}
