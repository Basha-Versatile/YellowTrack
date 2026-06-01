import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { requestPasswordResetOtp } from "@/server/services/passwordReset.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
});

export const POST = withRoute(async ({ req }) => {
  const { email } = await parseJson(req, bodySchema);
  await requestPasswordResetOtp(email);
  return success(null, "A verification code has been sent to your email.");
});
