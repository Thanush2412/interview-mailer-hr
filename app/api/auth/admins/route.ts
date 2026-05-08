import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getDb } from "@/lib/db";

const APP_ID = "interview-mailer";

async function requireAuth() {
  const user = await getSession();
  if (!user) return null;
  return user;
}

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ status: "error", message: "Unauthorised" }, { status: 401 });

  const db  = await getDb();
  const res = await db.query(
    "SELECT email, name FROM admin_emails WHERE app_id = $1 ORDER BY email",
    [APP_ID]
  );
  return NextResponse.json({ status: "ok", admins: res.rows });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ status: "error", message: "Unauthorised" }, { status: 401 });

  const { email, name } = await req.json() as { email?: string; name?: string };
  if (!email || !email.includes("@")) {
    return NextResponse.json({ status: "error", message: "Valid email required" }, { status: 400 });
  }

  const db = await getDb();
  await db.query(
    `INSERT INTO admin_emails (app_id, email, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (app_id, email) DO UPDATE SET name = COALESCE($3, admin_emails.name)`,
    [APP_ID, email.toLowerCase().trim(), name?.trim() || null]
  );
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

  const db = await getDb();
  await db.query("DELETE FROM admin_emails WHERE app_id = $1 AND email = $2", [APP_ID, email.toLowerCase().trim()]);
  return NextResponse.json({ status: "removed" });
}
