import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, getCurrentUser } from "@/lib/auth";

// The public marketing site (landing, pricing, features, etc.) lives in a
// separate repo/deployment now — this app is product-only. `/` is the
// authenticated home (redirects to `/assistant`), so the only unauthenticated
// entry points are `/login`, invite acceptance, and a handful of webhook/cron
// endpoints that authenticate themselves rather than via the session cookie.
const PUBLIC_PATHS = ["/login", "/unsubscribed"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname === "/api/auth/login" || pathname === "/api/auth/logout") return true;
  // "Sign in with Google" — a signed-out visitor must be able to start and complete this.
  if (pathname === "/api/auth/google/connect" || pathname === "/api/auth/google/callback") return true;
  // Waitlist signup on the (signed-out) login page.
  if (pathname === "/api/waitlist") return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname.startsWith("/api/unsubscribe/")) return true;
  // Verifies its own signature (svix) rather than a session cookie.
  if (pathname.startsWith("/api/webhooks/")) return true;
  // Invite accept flow must work for a signed-out browser.
  if (pathname.startsWith("/invite/")) return true;
  if (pathname.startsWith("/api/invites/")) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Loads the User row, not just the cookie signature — a deleted/removed
  // account must lose access immediately, not just once its 30-day JWT
  // happens to expire. See `getCurrentUser` for details.
  const user = await getCurrentUser(request);

  if (user) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
