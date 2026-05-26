import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { tenantOf } from "@/lib/auth/tenant-context";
import * as driverRepo from "@/server/repositories/driver.repository";
import { dispatchDriverVerifyLink } from "@/server/services/alertDispatcher.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  // Optional override email — falls back to the driver's stored email.
  email: z.string().email().optional(),
  // Verification token already minted by the existing onboarding flow.
  token: z.string().min(8),
});

/**
 * Send the driver's self-verification link by email + WhatsApp.
 * Admin-triggered — called from the "Share verification link" UI on the
 * driver detail page.
 */
export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    const ctx = tenantOf(session);
    const { email, token } = await parseJson(req, bodySchema);

    const driver = await driverRepo.findById(ctx, params.id);
    if (!driver) throw new NotFoundError("Driver not found");

    const d = driver as Record<string, unknown>;
    const recipient = email ?? (d.email as string | undefined);
    const phone = d.phone as string | undefined;
    if (!recipient && !phone) {
      throw new BadRequestError(
        "Driver has no email or phone on file — provide an email in the request body.",
      );
    }

    const baseUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
    await dispatchDriverVerifyLink({
      tenantId: String(ctx.tenantId),
      driverName: (d.name as string) ?? "Driver",
      driverEmail: recipient,
      driverPhone: phone,
      verifyUrl: `${baseUrl}/public/driver/verify/${token}`,
    });

    return success(
      { email: recipient ?? null, phone: phone ?? null },
      "Verification link dispatched",
    );
  },
  { auth: true },
);
