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
  // Always succeed — we never reveal whether the email exists.
  return success(null, "If an account exists for that email, a code has been sent.");
});
