import { NextRequest, NextResponse } from "next/server";
import { createSession, sessionCookieOptions } from "@/lib/session";
import { getAdminEmails } from "@/lib/db";

const APP_ID = "interview-mailer";

export async function POST(req: NextRequest) {
  try {
    const { credential } = await req.json() as { credential?: string };
    if (!credential) {
      console.log("[auth:im] No credential provided");
      return NextResponse.json({ status: "error", message: "No credential provided" }, { status: 400 });
    }

    const parts = credential.split(".");
    if (parts.length !== 3) {
      console.log("[auth:im] Invalid credential format");
      return NextResponse.json({ status: "error", message: "Invalid credential" }, { status: 400 });
    }

    const payload   = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    const userEmail = (payload.email as string || "").toLowerCase().trim();
    const userName  = (payload.name  as string) || userEmail;

    if (!userEmail) {
      console.log("[auth:im] No email in payload");
      return NextResponse.json({ status: "error", message: "No email in token" }, { status: 400 });
    }

    console.log(`[auth:im] Verifying ${userEmail}...`);
    const allowed = await getAdminEmails(APP_ID);
    console.log(`[auth:im] Allowed list:`, allowed);

    if (allowed.length > 0 && !allowed.includes(userEmail)) {
      console.log(`[auth:im] ${userEmail} not in allowed list`);
      return NextResponse.json({
        status:  "unauthorized",
        email:   userEmail,
        message: `${userEmail} is not authorised to access this system.`,
      }, { status: 403 });
    }

    console.log(`[auth:im] Creating session for ${userEmail}`);
    const token = await createSession({ email: userEmail, name: userName });

    const res = NextResponse.json({ status: "ok", name: userName, email: userEmail, token });
    res.cookies.set(sessionCookieOptions(token));
    return res;

  } catch (err: unknown) {
    console.error("[auth:im] 500 Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    return NextResponse.json({ status: "error", message, stack }, { status: 500 });
  }
}
