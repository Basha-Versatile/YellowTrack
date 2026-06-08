import { withRoute, parseJson } from "@/lib/api-handler";
import { success } from "@/lib/http";
import { z } from "zod";
import { tenantOf } from "@/lib/auth/tenant-context";
import { UnauthorizedError } from "@/lib/errors";
import { verifyResetAndSetPassword } from "@/server/services/customComplianceLock.service";
import { logFromRequest } from "@/server/services/activityLog.service";
import { CustomComplianceGroup } from "@/models";

export const runtime = "nodejs";

/**
 * Step 2 of forgot-password: verify OTP, set a new password. On success
 * the lock password is rotated, the failure counter / rate-limit are
 * cleared, and every existing unlock grant is wiped so a previously
 * unlocked operator must re-enter the new password.
 */
const bodySchema = z.object({
  otp: z.string().min(1).max(10),
  newPassword: z.string().min(6).max(200),
  confirmPassword: z.string().min(6).max(200),
});

export const POST = withRoute<{ id: string }>(
  async ({ req, params, session }) => {
    if (!session) throw new UnauthorizedError();
    const ctx = tenantOf(session);
    const input = await parseJson(req, bodySchema);
    await verifyResetAndSetPassword(
      ctx,
      params.id,
      input.otp,
      input.newPassword,
      input.confirmPassword,
    );
    const group = await CustomComplianceGroup.findById(params.id)
      .select("name")
      .lean();
    const name = (group as { name?: string } | null)?.name ?? "Folder";
    await logFromRequest(req, ctx, session, {
      action: "customCompliance.group.lock.reset_completed",
      entityType: "customComplianceGroup",
      entityId: params.id,
      entityLabel: name,
      summary: `Reset folder-lock password for "${name}"`,
    });
    return success({ ok: true }, "Password updated");
  },
  { auth: true },
);
