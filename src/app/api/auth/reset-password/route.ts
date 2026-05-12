import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { BadRequestError } from "@/lib/errors";
import { User } from "@/models";

export const runtime = "nodejs";

const bodySchema = z
  .object({
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

export const POST = withRoute(
  async ({ req, session }) => {
    const { newPassword } = await parseJson(req, bodySchema);
    if (!session) throw new BadRequestError("Not authenticated");

    const user = await User.findById(session.id).select("+password");
    if (!user) throw new BadRequestError("User not found");

    user.password = newPassword; // pre-save hook hashes
    user.mustResetPassword = false;
    await user.save();

    return success(null, "Password updated");
  },
  { auth: true },
);
