import { NextRequest, NextResponse } from "next/server";

/**
 * Coarse route protection at the edge: redirect to /login if the session
 * cookie is entirely absent. This is a UX optimization, not the security
 * boundary — the cookie's validity (expiry, revocation) is only knowable
 * against the database, so every server component/route handler under
 * /dashboard still calls getCurrentSession() and treats a null session as
 * unauthenticated, regardless of what middleware decided.
 */
const SESSION_COOKIE_NAME = "authforge_session";
const PROTECTED_PREFIXES = ["/dashboard"];

export function middleware(req: NextRequest) {
  const isProtected = PROTECTED_PREFIXES.some((p) => req.nextUrl.pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const hasCookie = req.cookies.has(SESSION_COOKIE_NAME);
  if (!hasCookie) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
