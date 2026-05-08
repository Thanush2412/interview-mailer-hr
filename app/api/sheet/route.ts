import { NextRequest, NextResponse } from "next/server";
import { resolveConfig } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const { sheetUrl: defaultSheet, gasUrl } = await resolveConfig("interview-mailer");
  const sheetUrl = searchParams.get("url") || defaultSheet;

  if (!sheetUrl) {
    return NextResponse.json({ status: "error", message: "No sheet URL provided" }, { status: 400 });
  }
  if (!gasUrl) {
    return NextResponse.json({ status: "error", message: "GAS_URL is not configured" }, { status: 500 });
  }

  const url = `${gasUrl}?action=getSheetData&url=${encodeURIComponent(sheetUrl)}&page=1&limit=1000`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ status: "error", message: `GAS ${res.status}: ${text.slice(0, 200)}` }, { status: 502 });
    }
    return NextResponse.json(await res.json());
  } catch (err: unknown) {
    return NextResponse.json({ status: "error", message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
