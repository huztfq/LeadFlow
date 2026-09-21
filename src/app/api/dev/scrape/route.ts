import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getScrapegraphHealth,
  isLocalScrapeAllowed,
  runLocalScrape,
} from "@/lib/scrapegraph-local";

export const maxDuration = 120;

function forbidden() {
  return NextResponse.json({ error: "Local scrape is disabled in production" }, { status: 404 });
}

export async function GET(request: NextRequest) {
  if (!isLocalScrapeAllowed()) return forbidden();
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const health = await getScrapegraphHealth();
  return NextResponse.json({ enabled: true, ...health });
}

export async function POST(request: NextRequest) {
  if (!isLocalScrapeAllowed()) return forbidden();
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { url?: string; prompt?: string };
  try {
    body = (await request.json()) as { url?: string; prompt?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = body.url?.trim() ?? "";
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "url must be http(s)" }, { status: 400 });
  }

  try {
    const result = await runLocalScrape({ url, prompt: body.prompt });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Local scrape failed";
    const sidecarDown = /fetch failed|ECONNREFUSED|aborted/i.test(message);
    return NextResponse.json(
      {
        error: sidecarDown
          ? "ScrapeGraph sidecar is not running. From the repo root: npm run scrapegraph:local"
          : message,
      },
      { status: 502 },
    );
  }
}
