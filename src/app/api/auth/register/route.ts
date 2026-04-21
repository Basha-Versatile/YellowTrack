import { withRoute, parseJson } from "@/lib/api-handler";
import { created } from "@/lib/http";
import { setRefreshCookie } from "@/lib/auth/cookies";
import { registerSchema } from "@/validations/auth.schema";
import { register as registerUser } from "@/server/services/auth.service";

export const runtime = "nodejs";

export const POST = withRoute(async ({ req }) => {
  const input = await parseJson(req, registerSchema);
  const { user, accessToken, refreshToken, refreshTokenExpiresAt } =
    await registerUser(input);

  const res = created(
    { user, accessToken },
    "Registration successful",
  );
  return setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
});
