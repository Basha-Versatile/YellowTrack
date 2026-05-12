import "server-only";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { verifyAccessToken, AccessTokenPayload } from "./jwt";
import { ACCESS_COOKIE_NAME } from "./cookies";

export type Session = AccessTokenPayload;

/**
 * For API routes: extracts + verifies a Bearer access token from the
 * Authorization header, falling back to the access-token cookie. Returns null
 * on missing/invalid/expired token.
 */
export async function getSessionFromRequest(
  req: NextRequest,
): Promise<Session | null> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  let token: string | null = null;

  if (header && header.startsWith("Bearer ")) {
    token = header.slice(7).trim() || null;
  }
  if (!token) {
    token = req.cookies.get(ACCESS_COOKIE_NAME)?.value || null;
  }
  if (!token) return null;

  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

/**
 * For server components and route layouts: reads the access-token cookie
 * (set by /api/auth/login + /api/auth/refresh). Returns null if missing or
 * invalid.
 */
export async function getSessionFromCookie(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}
