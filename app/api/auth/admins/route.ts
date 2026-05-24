import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAdmins, upsertAdminEmail, deleteAdminEmail } from "@/lib/db";

const APP_ID = "interview-mailer";

async function requireAuth() {
  const user = await getSession();
  if (!user) return null;
  return user;
}

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ status: "error", message: "Unauthorised" }, { status: 401 });

  const admins = await getAdmins(APP_ID);
  return NextResponse.json({ status: "ok", admins });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ status: "error", message: "Unauthorised" }, { status: 401 });

  const { email, name } = await req.json() as { email?: string; name?: string };
  if (!email || !email.includes("@")) {
    return NextResponse.json({ status: "error", message: "Valid email required" }, { status: 400 });
  }

  await upsertAdminEmail(APP_ID, email, name);
  return NextResponse.json({ status: "added" });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ status: "error", message: "Unauthorised" }, { status: 401 });

  const { email } = await req.json() as { email?: string };
  if (!email) return NextResponse.json({ status: "error", message: "Email required" }, { status: 400 });

  if (email.toLowerCase().trim() === user.email.toLowerCase()) {
    return NextResponse.json({ status: "error", message: "You cannot remove yourself" }, { status: 400 });
  }

  await deleteAdminEmail(APP_ID, email);
  return NextResponse.json({ status: "removed" });
}
