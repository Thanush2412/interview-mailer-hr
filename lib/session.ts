import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "im_session";
const TTL    = 60 * 60 * 8; // 8 hours

// Session secret — static env var, never from DB
// Must be the same value used to sign and verify
function getSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET environment variable is not set");
  return new TextEncoder().encode(s);
}

export interface SessionUser { email: string; name: string; }

export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL}s`)
    .sign(getSecret());
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, getSecret());
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
