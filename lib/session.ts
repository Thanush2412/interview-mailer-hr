import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { resolveConfig } from "./db";

const COOKIE = "im_session";
const TTL    = 60 * 60 * 8; // 8 hours

export interface SessionUser { email: string; name: string; }

async function getSecret(): Promise<Uint8Array> {
  const { sessionSecret } = await resolveConfig("interview-mailer");
  return new TextEncoder().encode(sessionSecret);
}

export async function createSession(user: SessionUser): Promise<string> {
  const secret = await getSecret();
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL}s`)
    .sign(secret);
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const store  = await cookies();
    const token  = store.get(COOKIE)?.value;
    if (!token) return null;
    const secret = await getSecret();
    const { payload } = await jwtVerify(token, secret);
    return { email: payload.email as string, name: payload.name as string };
  } catch { return null; }
}

export function sessionCookieOptions(token: string) {
  return {
    name: COOKIE, value: token, httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const, maxAge: TTL, path: "/",
  };
}
