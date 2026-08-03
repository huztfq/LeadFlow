import { prisma } from "@/lib/db";
import { fetchIcsEvents } from "@/lib/ical";
import { listGoogleEvents, refreshGoogleAccessToken } from "@/lib/calendar-google";

export const CALENDAR_CONNECTION_ID = "main";

export type AgendaEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string | null;
  source: "google" | "ical" | "manual";
};

export type CalendarConnectionSummary = {
  provider: "google" | "ical" | "link" | null;
  label: string | null;
  googleEmail: string | null;
  icalUrl: string | null;
  bookingUrl: string | null;
  connectedAt: string | null;
};

export function summarizeConnection(
  connection: {
    provider: string;
    label: string | null;
    googleEmail: string | null;
    icalUrl: string | null;
    bookingUrl: string | null;
    createdAt: Date;
  } | null,
): CalendarConnectionSummary {
  if (!connection) {
    return { provider: null, label: null, googleEmail: null, icalUrl: null, bookingUrl: null, connectedAt: null };
  }
  return {
    provider: connection.provider as CalendarConnectionSummary["provider"],
    label: connection.label,
    googleEmail: connection.googleEmail,
    // The iCal URL is a bearer-token-style secret (Google's "secret address in
    // iCal format"): never echo it back to the client once saved.
    icalUrl: connection.icalUrl ? "••••••••" : null,
    bookingUrl: connection.bookingUrl,
    connectedAt: connection.createdAt.toISOString(),
  };
}

/**
 * Fetches upcoming events for the Calendar page: locally-tracked
 * `CalendarEvent` rows (e.g. "booked" stubs) merged with a live read from the
 * active connection (Google Calendar or an iCal feed). Booking-link
 * connections have no readable event list, so they only ever contribute the
 * link itself (surfaced separately in the UI).
 */
export async function getUpcomingEvents(limit = 20): Promise<{
  events: AgendaEvent[];
  connection: CalendarConnectionSummary;
  warning: string | null;
}> {
  const connection = await prisma.calendarConnection.findUnique({ where: { id: CALENDAR_CONNECTION_ID } });
  const events: AgendaEvent[] = [];
  let warning: string | null = null;

  const manual = await prisma.calendarEvent.findMany({
    where: { startAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    orderBy: { startAt: "asc" },
    take: limit,
  });
  for (const event of manual) {
    events.push({
      id: `manual:${event.id}`,
      title: event.title,
      description: event.description,
      location: event.location,
      start: event.startAt.toISOString(),
      end: event.endAt?.toISOString() ?? null,
      source: "manual",
    });
  }

  if (connection?.provider === "google") {
    try {
      let accessToken = connection.accessToken;
      const expiringSoon = !connection.tokenExpiresAt || connection.tokenExpiresAt.getTime() < Date.now() + 60_000;
      if (expiringSoon && connection.refreshToken) {
        const refreshed = await refreshGoogleAccessToken(connection.refreshToken);
        accessToken = refreshed.access_token;
        await prisma.calendarConnection.update({
          where: { id: CALENDAR_CONNECTION_ID },
          data: {
            accessToken,
            tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
          },
        });
      }
      if (accessToken) {
        const googleEvents = await listGoogleEvents(accessToken, { timeMin: new Date(), maxResults: limit });
        for (const event of googleEvents) {
          events.push({
            id: `google:${event.id}`,
            title: event.title,
            description: event.description,
            location: event.location,
            start: event.start.toISOString(),
            end: event.end?.toISOString() ?? null,
            source: "google",
          });
        }
      }
    } catch (error) {
      warning = `Couldn't load Google Calendar events: ${error instanceof Error ? error.message : "unknown error"}`;
    }
  } else if (connection?.provider === "ical" && connection.icalUrl) {
    try {
      const icsEvents = await fetchIcsEvents(connection.icalUrl);
      const now = Date.now() - 60 * 60 * 1000;
      for (const event of icsEvents) {
        if (event.start.getTime() < now) continue;
        events.push({
          id: `ical:${event.start.toISOString()}:${event.title}`,
          title: event.title,
          description: event.description,
          location: event.location,
          start: event.start.toISOString(),
          end: event.end?.toISOString() ?? null,
          source: "ical",
        });
      }
    } catch (error) {
      warning = `Couldn't load the iCal feed: ${error instanceof Error ? error.message : "unknown error"}`;
    }
  }

  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return {
    events: events.slice(0, limit),
    connection: summarizeConnection(connection),
    warning,
  };
}
