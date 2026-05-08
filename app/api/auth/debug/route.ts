import { NextResponse } from "next/server";

export async function GET() {
  const gasUrl   = process.env.GAS_URL;
  const sheetUrl = process.env.NEXT_PUBLIC_SHEET_URL;

  if (!gasUrl) return NextResponse.json({ error: "GAS_URL not set" });

  const url = sheetUrl
    ? `${gasUrl}?action=getAdmins&url=${encodeURIComponent(sheetUrl)}`
    : `${gasUrl}?action=getAdmins`;

  try {
    const res  = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return NextResponse.json({ url, status: res.status, data });
  } catch (err: unknown) {
    return NextResponse.json({ url, error: String(err) });
  }
}
