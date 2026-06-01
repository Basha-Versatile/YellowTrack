import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import {
  REFRESH_COOKIE_NAME,
  clearAccessCookie,
  clearRefreshCookie,
  setAccessCookie,
  setRefreshCookie,
} from "@/lib/auth/cookies";
import { refresh as refreshTokens } from "@/server/services/auth.service";
import { AppError } from "@/lib/errors";
import { error as errorResponse } from "@/lib/http";

export const runtime = "nodejs";

export const POST = withRoute(async ({ req }) => {
  const token = req.cookies.get(REFRESH_COOKIE_NAME)?.value;

  try {
    const {
      user,
      tenant,
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
      persistent,
    } = await refreshTokens(token);
    const res = success(
      { user, tenant, accessToken, persistent },
      "Token refreshed",
    );
    setAccessCookie(res, accessToken, persistent);
    return setRefreshCookie(res, refreshToken, refreshTokenExpiresAt, persistent);
  } catch (err) {
    // Always clear the bad cookies on failure (matches legacy controller behaviour)
    const status = err instanceof AppError ? err.statusCode : 500;
    const message = err instanceof AppError ? err.message : "Internal server error";
    const res = errorResponse(message, status);
    clearAccessCookie(res);
    return clearRefreshCookie(res);
  }
});
