import { NextResponse } from "next/server";
import { getConfig, getAdmins } from "@/lib/db";

const APP_ID = "interview-mailer";

export async function GET() {
  const uri = process.env.DATABASE_URL;
  const hasDbUrl = !!uri;

  try {
    const cfg = await getConfig(APP_ID);
    const admins = await getAdmins(APP_ID);

    return NextResponse.json({
      status:   "connected",
      uriPrefix: uri ? uri.slice(0, 40) + "…" : "N/A",
      config:   cfg,
      admins:   admins,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

