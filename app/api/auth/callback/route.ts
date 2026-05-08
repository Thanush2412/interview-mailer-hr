import { NextRequest, NextResponse } from "next/server";
import { createSession, sessionCookieOptions } from "@/lib/session";

// Fetch allowed admin emails from GAS → sheet "Admins" tab
async function fetchAllowedEmails(): Promise<string[]> {
  const gasUrl   = process.env.GAS_URL;
  const sheetUrl = process.env.NEXT_PUBLIC_SHEET_URL;
  if (!gasUrl) return [];
  try {
    const url = sheetUrl
      ? `${gasUrl}?action=getAdmins&url=${encodeURIComponent(sheetUrl)}`
      : `${gasUrl}?action=getAdmins`;
    const res  = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (Array.isArray(data.admins)) {
      return data.admins.map((a: { email: string }) => a.email.toLowerCase().trim());
    }
  } catch { /* fall through */ }
  return [];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/login?error=cancelled", req.url));
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  process.env.GOOGLE_REDIRECT_URI!,
      grant_type:    "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/login?error=token_failed", req.url));
  }

  const tokens  = await tokenRes.json();
  const idToken = tokens.id_token;
  if (!idToken) {
    return NextResponse.redirect(new URL("/login?error=no_token", req.url));
  }

  // Decode JWT payload (no verification needed — Google already validated)
  const payload   = JSON.parse(Buffer.from(idToken.split(".")[1], "base64").toString());
  const userEmail = (payload.email as string).toLowerCase().trim();
  const userName  = (payload.name  as string) || userEmail;

  // Check against allowed emails from sheet
  const allowed = await fetchAllowedEmails();
  if (allowed.length > 0 && !allowed.includes(userEmail)) {
    return NextResponse.redirect(new URL(`/login?error=unauthorized&email=${encodeURIComponent(userEmail)}`, req.url));
  }

  // Create session and redirect to app
  const token = await createSession({ email: userEmail, name: userName });
  const res   = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(sessionCookieOptions(token));
  return res;
}
