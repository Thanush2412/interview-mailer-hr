import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ status: "unauthenticated" }, { status: 401 });
  return NextResponse.json({ status: "ok", email: user.email, name: user.name });
}
