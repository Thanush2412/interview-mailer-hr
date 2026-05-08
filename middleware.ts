import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET  = new TextEncoder().encode(
  process.env.SESSION_SECRET || "faceprep-interview-mailer-secret-fallback"
);
const PUBLIC = ["/login", "/api/auth/google-signin", "/api/auth/google", "/api/auth/callback", "/api/auth/debug"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Allow static assets
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return NextResponse.next();

  const token = req.cookies.get("im_session")?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  try {
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
