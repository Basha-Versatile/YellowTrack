import "server-only";
import { NextResponse } from "next/server";
import { env } from "../env";

export const REFRESH_COOKIE_NAME = "refreshToken";
export const REFRESH_COOKIE_PATH = "/api/auth";

export function setRefreshCookie(
  res: NextResponse,
  token: string,
  expiresAt: Date,
): NextResponse {
  res.cookies.set({
    name: REFRESH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "strict" : "lax",
    path: REFRESH_COOKIE_PATH,
    expires: expiresAt,
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
