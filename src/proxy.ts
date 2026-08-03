import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, getCurrentUser } from "@/lib/auth";

// Public marketing site (`src/app/(marketing)/*`) — no sidebar, no auth
// required. Kept separate from the authenticated app, which lives at
// `/assistant`, `/search`, `/campaigns`, etc. (see `src/app/(app)/*`).
const MARKETING_PATHS = ["/", "/pricing", "/features", "/about", "/privacy", "/terms", "/contact"];

const PUBLIC_PATHS = ["/login", "/unsubscribed", ...MARKETING_PATHS];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname === "/api/auth/login" || pathname === "/api/auth/logout") return true;
  // "Sign in with Google" — a signed-out visitor must be able to start and complete this.
  if (pathname === "/api/auth/google/connect" || pathname === "/api/auth/google/callback") return true;
  // Waitlist signup on the (signed-out) login page, and the marketing site's contact form.
  if (pathname === "/api/waitlist" || pathname === "/api/contact") return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname.startsWith("/api/unsubscribe/")) return true;
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
