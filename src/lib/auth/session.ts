import "server-only";
import { NextRequest } from "next/server";
import { verifyAccessToken, AccessTokenPayload } from "./jwt";

export type Session = AccessTokenPayload;

/**
 * Extracts + verifies a Bearer access token from the Authorization header.
 * Returns null on missing/invalid/expired token.
 */
export async function getSessionFromRequest(
  req: NextRequest,
): Promise<Session | null> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) return null;

  const token = header.slice(7).trim();
  if (!token) return null;

  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}
