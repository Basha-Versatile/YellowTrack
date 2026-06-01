import "server-only";
import { NextResponse } from "next/server";
import { env } from "../env";

export const REFRESH_COOKIE_NAME = "refreshToken";
export const REFRESH_COOKIE_PATH = "/api/auth";

// Access-token cookie: site-wide path so server components / middleware can
// read it during page navigation. Short-lived to match the JWT expiry.
export const ACCESS_COOKIE_NAME = "accessToken";
const ACCESS_COOKIE_MAX_AGE_SEC = 60 * 60 * 12; // 12h ceiling; JWT exp still wins

export function setRefreshCookie(
  res: NextResponse,
  token: string,
  expiresAt: Date,
  persistent = true,
): NextResponse {
  res.cookies.set({
    name: REFRESH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "strict" : "lax",
    path: REFRESH_COOKIE_PATH,
    // Persistent: outlives browser close until expiresAt.
    // Non-persistent (Remember Me off): session cookie, dies on browser close.
    ...(persistent ? { expires: expiresAt } : {}),
  });
  return res;
}

export function clearRefreshCookie(res: NextResponse): NextResponse {
  res.cookies.set({
    name: REFRESH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "strict" : "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: 0,
  });
  return res;
}

export function setAccessCookie(
  res: NextResponse,
  token: string,
  persistent = true,
): NextResponse {
  res.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/",
    ...(persistent ? { maxAge: ACCESS_COOKIE_MAX_AGE_SEC } : {}),
  });
  return res;
}

export function clearAccessCookie(res: NextResponse): NextResponse {
  res.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
