import { NextRequest, NextResponse } from "next/server";
import { getConfig, upsertConfig } from "@/lib/db";

const APP_ID = "interview-mailer";

export async function GET() {
  try {
    const row = await getConfig(APP_ID);
    return NextResponse.json({
      status:           "ok",
      sheetUrl:         row?.sheet_url        || "",
      gasUrl:           row?.gas_url          || "",
      googleClientId:   row?.google_client_id || "",
      sessionSecretSet: !!row?.session_secret,
      columnMapping:    row?.column_map       || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[config GET]", message);
    return NextResponse.json({
      status: "error", message,
      sheetUrl: "", gasUrl: "", googleClientId: "",
      sessionSecretSet: false, columnMapping: null,
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sheetUrl, gasUrl, columnMapping,
      googleClientId, googleClientSec, sessionSecret,
    } = body as {
      sheetUrl?: string; gasUrl?: string; columnMapping?: object;
      googleClientId?: string; googleClientSec?: string; sessionSecret?: string;
    };

    await upsertConfig(APP_ID, {
      sheetUrl:        sheetUrl        || undefined,
      gasUrl:          gasUrl          || undefined,
      columnMap:       columnMapping,
      googleClientId:  googleClientId  || undefined,
      googleClientSec: googleClientSec || undefined,
      sessionSecret:   sessionSecret   || undefined,
    });
    return NextResponse.json({ status: "saved" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[config POST]", message);
    return NextResponse.json({ status: "saved", dbError: message });
  }
}
