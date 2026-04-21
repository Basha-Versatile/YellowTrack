import { withRoute } from "@/lib/api-handler";
import { success } from "@/lib/http";
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
} from "@/lib/auth/cookies";
import { logout as logoutToken } from "@/server/services/auth.service";

export const runtime = "nodejs";

export const POST = withRoute(async ({ req }) => {
  const token = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  await logoutToken(token);

  const res = success(null, "Logged out successfully");
  return clearRefreshCookie(res);
});
