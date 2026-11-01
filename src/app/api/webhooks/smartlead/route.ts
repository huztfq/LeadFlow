import { NextRequest, NextResponse } from "next/server";
import { handleSmartleadWebhook, webhookTokenValid } from "@/lib/smartlead-sync";

/**
 * Smartlead webhook (replies, unsubscribes, bounces). Registered per campaign
 * by ensureSmartleadCampaign() as `${APP_URL}/api/webhooks/smartlead?token=…`;
 * Smartlead doesn't sign payloads, so the shared token is the check.
 */
export async function POST(request: NextRequest) {
  if (!webhookTokenValid(request.nextUrl.searchParams.get("token"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    return NextResponse.json(await handleSmartleadWebhook(body));
  } catch (error) {
    console.error("[smartlead webhook]", error);
    // 500 so Smartlead retries; replies are deduped by message id.
    return NextResponse.json({ error: "Failed to process event" }, { status: 500 });
  }
}
