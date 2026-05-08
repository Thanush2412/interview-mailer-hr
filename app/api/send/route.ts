import { NextRequest, NextResponse } from "next/server";
import { resolveConfig } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body   = await req.json();
  const { gasUrl } = await resolveConfig("interview-mailer");

  if (!gasUrl) {
    return NextResponse.json({ status: "error", message: "GAS_URL not configured" }, { status: 500 });
  }
  try {
    const res = await fetch(gasUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json());
  } catch (err: unknown) {
    return NextResponse.json({ status: "failed", error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
