import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { resetPasswordWithToken } from "@/server/services/passwordReset.service";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    verifyToken: z.string().min(1),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const POST = withRoute(async ({ req }) => {
  const { verifyToken, newPassword } = await parseJson(req, bodySchema);
  await resetPasswordWithToken(verifyToken, newPassword);
  return success(null, "Password updated. You can sign in with your new password.");
});
