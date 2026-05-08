import { NextRequest, NextResponse } from "next/server";

const PUBLIC = ["/login", "/api/auth/google-signin", "/api/auth/google", "/api/auth/callback", "/api/auth/debug", "/api/auth/logout", "/api/auth/me"];

// Middleware only checks cookie PRESENCE.
// Full JWT verification (with DB-sourced secret) happens in each API route and page.
// This is intentional — middleware runs on Edge and cannot call the DB.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return NextResponse.next();

  const token = req.cookies.get("im_session")?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  // Cookie exists — let the page/API verify the JWT with the correct secret
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
