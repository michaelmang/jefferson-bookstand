import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import { cookies } from "next/headers";
import { getDb } from "./db";

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const SESSION_COOKIE = "jb_session";

export type SessionUser = { id: number; name: string; picture: string | null };

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    console.warn("AUTH_SECRET is not set — using an insecure development fallback.");
  }
  return new TextEncoder().encode(secret || "dev-insecure-bookstand-secret");
}

export function googleClientId(): string | null {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || null;
}

/** Verifies a Google Identity Services ID token and returns its profile claims. */
export async function verifyGoogleCredential(credential: string) {
  const clientId = googleClientId();
  if (!clientId) throw new Error("Google sign-in is not configured");
  const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });
  return {
    sub: String(payload.sub),
    name: typeof payload.name === "string" ? payload.name : "Reader",
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}

export async function upsertUser(profile: {
  sub: string;
  name: string;
  picture: string | null;
}): Promise<number> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO users (google_sub, name, picture, created_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(google_sub) DO UPDATE SET name = excluded.name, picture = excluded.picture`,
    args: [profile.sub, profile.name, profile.picture, Date.now()],
  });
  const rs = await db.execute({
    sql: "SELECT id FROM users WHERE google_sub = ?",
    args: [profile.sub],
  });
  return Number(rs.rows[0].id);
}

export async function createSession(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const rs = await (
      await getDb()
    ).execute({
      sql: "SELECT id, name, picture FROM users WHERE id = ?",
      args: [payload.uid as number],
    });
    const row = rs.rows[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      name: String(row.name),
      picture: row.picture === null ? null : String(row.picture),
    };
  } catch {
    return null;
  }
}
