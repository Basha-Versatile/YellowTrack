import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { verifyPasswordResetOtp } from "@/server/services/passwordReset.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const POST = withRoute(async ({ req }) => {
  const { email, otp } = await parseJson(req, bodySchema);
  const { verifyToken } = await verifyPasswordResetOtp(email, otp);
  return success({ verifyToken }, "Code verified");
});
