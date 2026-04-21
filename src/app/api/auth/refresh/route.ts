import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  setRefreshCookie,
} from "@/lib/auth/cookies";
import { refresh as refreshTokens } from "@/server/services/auth.service";
import { AppError } from "@/lib/errors";
import { error as errorResponse } from "@/lib/http";

export const runtime = "nodejs";

export const POST = withRoute(async ({ req }) => {
  const token = req.cookies.get(REFRESH_COOKIE_NAME)?.value;

  try {
    const { user, accessToken, refreshToken, refreshTokenExpiresAt } =
      await refreshTokens(token);
    const res = success({ user, accessToken }, "Token refreshed");
    return setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
  } catch (err) {
    // Always clear the bad cookie on failure (matches legacy controller behaviour)
    const status = err instanceof AppError ? err.statusCode : 500;
    const message = err instanceof AppError ? err.message : "Internal server error";
    const res = errorResponse(message, status);
    return clearRefreshCookie(res);
  }
});
