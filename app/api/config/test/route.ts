import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    return NextResponse.json({ status: "error", message: "DATABASE_URL is not set in .env.local" }, { status: 500 });
  }

  try {
    const db  = await getDb();
    const cfg = await db.query("SELECT app_id, sheet_url, updated_at FROM app_config WHERE app_id = $1", ["interview-mailer"]);
    const adm = await db.query("SELECT email, name FROM admin_emails WHERE app_id = $1", ["interview-mailer"]);

    return NextResponse.json({
      status:    "connected",
      uriPrefix: uri.slice(0, 40) + "…",
      config:    cfg.rows[0] ?? null,
      admins:    adm.rows,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
