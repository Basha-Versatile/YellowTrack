import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { setRefreshCookie } from "@/lib/auth/cookies";
import { loginSchema } from "@/validations/auth.schema";
import { login as loginUser } from "@/server/services/auth.service";

export const runtime = "nodejs";

export const POST = withRoute(async ({ req }) => {
  const input = await parseJson(req, loginSchema);
  const { user, accessToken, refreshToken, refreshTokenExpiresAt } =
    await loginUser(input);

  const res = success({ user, accessToken }, "Login successful");
  return setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
});
