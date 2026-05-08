import { NextRequest, NextResponse } from "next/server";
import { createSession, sessionCookieOptions } from "@/lib/session";
import { getAdminEmails } from "@/lib/db";

const APP_ID = "interview-mailer";

export async function POST(req: NextRequest) {
  try {
    const { credential } = await req.json() as { credential?: string };
    if (!credential) {
      return NextResponse.json({ status: "error", message: "No credential provided" }, { status: 400 });
    }

    const parts = credential.split(".");
    if (parts.length !== 3) {
      return NextResponse.json({ status: "error", message: "Invalid credential" }, { status: 400 });
    }

    const payload   = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    const userEmail = (payload.email as string || "").toLowerCase().trim();
    const userName  = (payload.name  as string) || userEmail;

    if (!userEmail) {
      return NextResponse.json({ status: "error", message: "No email in token" }, { status: 400 });
    }

    const allowed = await getAdminEmails(APP_ID);
    console.log(`[auth:im] ${userEmail} | allowed (${allowed.length}):`, allowed);

    if (allowed.length > 0 && !allowed.includes(userEmail)) {
      return NextResponse.json({
        status:  "unauthorized",
        email:   userEmail,
        message: `${userEmail} is not authorised to access this system.`,
      }, { status: 403 });
    }

    const token = await createSession({ email: userEmail, name: userName });
    const res   = NextResponse.json({ status: "ok", name: userName, email: userEmail });
    res.cookies.set(sessionCookieOptions(token));
    return res;

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
