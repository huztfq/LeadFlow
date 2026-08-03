import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

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

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = token ? await verifySessionToken(token) : false;

  if (valid) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
